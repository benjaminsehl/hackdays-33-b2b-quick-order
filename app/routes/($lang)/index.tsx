import {Form, useLoaderData} from '@remix-run/react';
import type {
  CollectionConnection,
  Product,
  ProductConnection,
} from '@shopify/hydrogen/storefront-api-types';
import {defer, type LoaderArgs} from '@shopify/remix-oxygen';
import invariant from 'tiny-invariant';
import {Button, Input, Pagination, Section} from '~/components';
import {ProductBulkOrderForm} from '~/components/ProductBulkOrderForm';
import {fetchCustomerPricing} from '~/lib/fetchCustomerPricing';

export default function () {
  const {searchTerm, products, prices} = useLoaderData<typeof loader>();
  const noResults = products?.nodes?.length === 0;

  return (
    <>
      <header className="px-6 py-24 md:px-8 lg:px-12">
        <Form
          method="get"
          className="relative flex w-full text-lead md:text-heading"
        >
          <Input
            defaultValue={searchTerm}
            placeholder="Search for a snowboard…"
            type="search"
            variant="search"
            name="q"
            autofocus
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
        <section className="flex flex-col w-full gap-4 border-none md:gap-8 md:p-8 lg:p-12">
          <Pagination connection={products}>
            {({
              endCursor,
              hasNextPage,
              hasPreviousPage,
              nextPageUrl,
              nodes,
              prevPageUrl,
              startCursor,
              nextLinkRef,
              isLoading,
            }) => (
              <>
                {hasPreviousPage && (
                  <div className="flex items-center justify-center mt-6">
                    <Button
                      to={prevPageUrl}
                      variant="secondary"
                      width="full"
                      prefetch="intent"
                      disabled={!isLoading}
                      state={{
                        pageInfo: {
                          endCursor,
                          hasNextPage,
                          startCursor,
                        },
                        nodes,
                      }}
                    >
                      {isLoading ? 'Loading...' : 'Previous products'}
                    </Button>
                  </div>
                )}
                {nodes.map((product: Product) => (
                  <ProductBulkOrderForm
                    key={product.id}
                    product={product}
                    priceOverrides={prices}
                    className="snap-start"
                  />
                ))}
                {hasNextPage && (
                  <div className="flex items-center justify-center mt-6">
                    <Button
                      ref={nextLinkRef}
                      to={nextPageUrl}
                      variant="secondary"
                      width="full"
                      prefetch="intent"
                      disabled={!isLoading}
                      state={{
                        pageInfo: {
                          endCursor,
                          hasPreviousPage,
                          startCursor,
                        },
                        nodes,
                      }}
                    >
                      {isLoading ? 'Loading...' : 'Next products'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Pagination>
        </section>
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
      pageBy: 100,
      searchTerm,
      cursor,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  });
  const {prices} = await fetchCustomerPricing(context);

  invariant(data, 'No data returned from Shopify API');
  const {products} = data;

  return defer({
    searchTerm,
    products,
    prices,
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
