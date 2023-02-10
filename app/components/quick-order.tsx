import {Form, useLoaderData} from '@remix-run/react';
import {flattenConnection} from '@shopify/hydrogen';
import type {
  CollectionConnection,
  ProductConnection,
} from '@shopify/hydrogen/storefront-api-types';
import {defer, type LoaderArgs} from '@shopify/remix-oxygen';
import invariant from 'tiny-invariant';
import {Input, Section} from '~/components';
import {ProductBulkOrderForm} from '~/components/ProductBulkOrderForm';
import {PAGINATION_SIZE} from '~/lib/const';
import {fetchCustomerPricing} from '~/lib/fetchCustomerPricing';

export default function () {
  const {searchTerm, products, prices, noResultRecommendations} =
    useLoaderData<typeof loader>();
  const noResults = products?.nodes?.length === 0;

  return (
    <>
      <header className="px-6 py-4 md:px-8 lg:px-12">
        <Form method="get" className="relative flex w-full text-heading">
          <Input
            defaultValue={searchTerm}
            placeholder="Search for a product…"
            type="search"
            variant="search"
            name="q"
          />
          <button className="absolute right-0 py-2" type="submit">
            Go
          </button>
        </Form>
      </header>
      {noResults && (
        <>
          <Section>
            No matching products found. Please change your search and try again
          </Section>
        </>
      )}
      {!searchTerm || noResults ? (
        <Section>
          {/* {noResults && (
            <Section padding="x">
              <Text className="opacity-50">
                No results, try something else.
              </Text>
            </Section>
          )}
          <Suspense>
            <Await
              errorElement="There was a problem loading related products"
              resolve={noResultRecommendations}
            >
              {(data) => (
                <div className="flex flex-col gap-8 px-8 py-10 lg:px-12">
                  <header>
                    <Heading size="lead">Featured Products</Heading>
                  </header>
                  <section>
                    {data?.featuredProducts &&
                      data.featuredProducts.map((product) => (
                        <ProductBulkOrderForm
                          key={product.id}
                          product={product}
                          className="snap-start w-80"
                        />
                      ))}
                  </section>
                </div>
              )}
            </Await>
          </Suspense> */}
        </Section>
      ) : (
        <Section>
          {products?.nodes &&
            products?.nodes.map((product) => (
              <ProductBulkOrderForm
                key={product.id}
                product={product}
                priceOverrides={prices}
                className="snap-start"
              />
            ))}
        </Section>
      )}
    </>
  );
}

export async function loader({request, context}: LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const cursor = searchParams.get('cursor')!;
  const searchTerm = searchParams.get('q')!;
  const {storefront} = context;

  const data = await storefront.query<{
    products: ProductConnection;
  }>(SEARCH_QUERY, {
    variables: {
      pageBy: PAGINATION_SIZE,
      searchTerm,
      cursor,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  });
  const {prices} = await fetchCustomerPricing(context);

  invariant(data, 'No data returned from Shopify API');
  const {products} = data;

  const getRecommendations = !searchTerm || products?.nodes?.length === 0;

  return defer({
    searchTerm,
    products,
    prices,
    noResultRecommendations: getRecommendations
      ? getNoResultRecommendations(storefront)
      : Promise.resolve(null),
  });
}

const PRODUCT_BULK_ORDER_FORM_FRAGMENT = `#graphql
  fragment ProductBulkOrderForm on Product {
    id
    title
    publishedAt
    handle
    priceRange {
        minVariantPrice {
            amount
            currencyCode
        }
        maxVariantPrice {
            amount
            currencyCode
        }
    }
    variants(first: 100) {
      nodes {
        id
        quantityAvailable
        sku
        title
        image {
          url
          altText
          width
          height
        }
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
      }
    }
  }
`;

const SEARCH_QUERY = `#graphql
  ${PRODUCT_BULK_ORDER_FORM_FRAGMENT}
  query search(
    $searchTerm: String
    $country: CountryCode
    $language: LanguageCode
    $pageBy: Int!
    $after: String
  ) @inContext(country: $country, language: $language) {
    products(
      first: $pageBy
      sortKey: RELEVANCE
      query: $searchTerm
      after: $after
    ) {
      nodes {
        ...ProductBulkOrderForm
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export async function getNoResultRecommendations(
  storefront: LoaderArgs['context']['storefront'],
) {
  const data = await storefront.query<{
    featuredCollections: CollectionConnection;
    featuredProducts: ProductConnection;
  }>(SEARCH_NO_RESULTS_QUERY, {
    variables: {
      pageBy: PAGINATION_SIZE,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  });

  invariant(data, 'No data returned from Shopify API');

  return {
    featuredCollections: flattenConnection(data.featuredCollections),
    featuredProducts: flattenConnection(data.featuredProducts),
  };
}

const SEARCH_NO_RESULTS_QUERY = `#graphql
  ${PRODUCT_BULK_ORDER_FORM_FRAGMENT}
  query searchNoResult(
    $country: CountryCode
    $language: LanguageCode
    $pageBy: Int!
  ) @inContext(country: $country, language: $language) {
    featuredProducts: products(first: $pageBy) {
      nodes {
        ...ProductBulkOrderForm
      }
    }
  }
`;
