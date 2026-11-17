export async function authorizeCoachingMapRead(sql, session, clientId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('denied');
  const [allowed] = await sql`select c.id from public.clients c where c.id=${clientId}::uuid and
    (${session.profile.role==='admin'}
      or (${session.profile.role==='client'} and c.profile_id=${session.userId}::uuid)
      or (${session.profile.role==='coach'} and exists(select 1 from public.coach_client_assignments a
        join public.coaches co on co.id=a.coach_id where a.client_id=c.id and co.profile_id=${session.userId}::uuid)))`;
  if (!allowed) throw new Error('denied');
}

export function clientCoachingBundle(bundle) {
  const recommendations = new Map(bundle.recommendations.map(review => [review.recommendation_key, review]));
  return {
    ...bundle,
    topics: bundle.topics.map(review => ({...review, note: ''})),
    recommendations: bundle.recommendations.filter(review => review.state !== 'dismissed').map(review => ({...review, note: ''})),
    versions: bundle.versions.slice(0, 1).map(version => ({
      ...version,
      cost_usd: null,
      analysis: {
        ...version.analysis,
        recommendations: version.analysis.recommendations.flatMap(item => {
          const review = recommendations.get(item.key);
          if (review?.state === 'dismissed') return [];
          return [{...item, action: review?.state === 'edited' ? review.note : item.action}];
        }),
      },
    })),
  };
}
