import {AppLoadContext} from '@shopify/remix-oxygen';

// Simple wrapper for querying the admin API
export async function adminQuery(
  query: any,
  {variables, context}: {variables: any; context: AppLoadContext},
): Promise<any> {
  const {env} = context;
  const response = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/unstable/graphql.json`,
    {
      method: 'POST',
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.PUBLIC_ADMIN_API_TOKEN,
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({
        query,
        variables,
      }),
    },
  );
  return response.json();
}
