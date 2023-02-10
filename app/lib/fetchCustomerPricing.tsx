import {AppLoadContext} from '@shopify/remix-oxygen';
import {adminQuery} from '~/lib/adminApiQuery';
import {getCustomer} from '~/routes/($lang)/account';

export async function fetchCustomerPricing(context: AppLoadContext) {
  const {session} = context;
  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken) {
    return {customer: null, prices: {}};
  }

  const customer = await getCustomer(context, customerAccessToken);
  const prices = await getPriceListPrices(customer.id, context);
  return {customer, prices};
}

const CUSTOMER_LOCATIONS_QUERY = `#graphql
  query CustomerLocations(
    $customerId: ID!
  ) {
    customer(id: $customerId) {
      companyContactProfiles {
        roleAssignments(first: 100) {
          nodes {
            companyLocation {
              id
            }
          }
        }
      }
    }
  }
`;

async function getPriceListPrices(
  customerId: string,
  context: AppLoadContext,
): Promise<any> {
  let response = await adminQuery(CUSTOMER_LOCATIONS_QUERY, {
    variables: {customerId},
    context,
  });
  const locationIds = response.data.customer.companyContactProfiles.flatMap(
    (p: any) => p.roleAssignments.nodes.map((n: any) => n.companyLocation.id),
  );

  response = await adminQuery(PRICE_LISTS_QUERY, {
    variables: {
      query: locationIds
        .map((id: string) => `company_location_id=${id}`)
        .join(' | '),
    },
    context,
  });

  return response.data.priceLists.nodes
    .flatMap((n: any) => n.prices.nodes)
    .reduce((prices: any, price: any) => {
      prices[price.variant.id] = price;
      return prices;
    }, {});
}

const PRICE_LISTS_QUERY = `#graphql
  query PriceListsByLocation(
    $query: String!
  ) {
    priceLists(query: $query, first: 100) {
      nodes {
        id
        currency
        prices(first: 100) {
          nodes {
            compareAtPrice {
              amount
              currencyCode
            }
            price {
              amount
              currencyCode
            }
            variant {
              id
            }
          }
        }
      }
    }
  }
`;
