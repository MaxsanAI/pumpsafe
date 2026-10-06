export const onRequest: PagesFunction = async ({ next }) => {
  const response = await next();
  response.headers.set('x-content-type-options','nosniff');
  response.headers.set('referrer-policy','strict-origin-when-cross-origin');
  response.headers.set('x-frame-options','DENY');
  return response;
};
