import {
  Image,
  Money,
  ShopifyAnalyticsProduct,
  useMoney,
} from '@shopify/hydrogen';
import type {
  MoneyV2,
  Product,
  ProductVariant,
} from '@shopify/hydrogen/storefront-api-types';
import type {SerializeFrom} from '@shopify/remix-oxygen';
import clsx from 'clsx';
import {AddToCartButton, Text} from '~/components';
import {getProductPlaceholder} from '~/lib/placeholders';
import {isDiscounted, isNewArrival} from '~/lib/utils';

import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  SortingFn,
  sortingFns,
  Table,
  useReactTable,
} from '@tanstack/react-table';

import {
  compareItems,
  RankingInfo,
  rankItem,
} from '@tanstack/match-sorter-utils';
import {InputHTMLAttributes, useEffect, useMemo, useState} from 'react';

declare module '@tanstack/table-core' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
  interface FilterMeta {
    itemRank: RankingInfo;
  }
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value);

  // Store the itemRank info
  addMeta({
    itemRank,
  });

  // Return if the item should be filtered in/out
  return itemRank.passed;
};

const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  let dir = 0;

  // Only sort by rank if the column has ranking information
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId]?.itemRank!,
      rowB.columnFiltersMeta[columnId]?.itemRank!,
    );
  }

  // Provide an alphanumeric fallback for when the item ranks are equal
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir;
};

function Table({data, setData}: {data: ProductVariant[]; setData: () => void}) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ProductVariant, any>[]>(
    () => [
      {
        accessorFn: (row) => row.id.split('ProductVariant/')[1],
        id: 'id',
        cell: (info) => info.getValue(),
        header: () => <span className="table w-full text-left">SKU</span>,
      },
      {
        accessorKey: 'title',
        cell: (info) => info.getValue(),
        header: () => <span className="table w-full text-left">Title</span>,
      },
      {
        accessorFn: (row) => <Money data={row.price!} />,
        id: 'price',
        cell: (info) => info.getValue(),
        header: () => (
          <span className="table w-full text-left">Unit Price</span>
        ),
      },
      {
        accessorFn: (row) => (
          <input
            defaultValue={0}
            type="number"
            className="w-20 bg-transparent border-none focus:outline-none focus:border-b"
          />
        ),
        id: 'quantity',
        cell: ({getValue, row: {index}, column: {id}, table}) => {
          // We need to keep and update the state of the cell normally
          const [value, setValue] = useState('');
          const [showQuantityAlert, setShowQuantityAlert] = useState(false);

          return (
            <div className="relative">
              <input
                className="w-20 bg-transparent border-b focus:outline-none focus:border-primary"
                value={value as string}
                onChange={(e) => {
                  setShowQuantityAlert(false);
                  if (!data[index].quantityAvailable)
                    return setValue(e.target.value);
                  if (Number(e.target.value) > data[index].quantityAvailable!) {
                    setShowQuantityAlert(true);
                  }
                  setValue(e.target.value);
                }}
                onBlur={(e) => {
                  if (!data[index].quantityAvailable)
                    return table.options.meta?.updateData(index, id, value);
                  if (Number(e.target.value) > data[index].quantityAvailable!) {
                    setValue(String(data[index].quantityAvailable));
                    setShowQuantityAlert(false);
                  }
                  table.options.meta?.updateData(index, id, value);
                }}
                placeholder="0"
              />
              <div
                className={`${
                  showQuantityAlert ? 'absolute' : 'hidden'
                } transition duration-150 ease-all text-primary/60 text-sm `}
              >{`only ${data[index].quantityAvailable} available`}</div>
            </div>
          );
        },
        header: () => <span className="table w-full text-left">Quantity</span>,
      },
      {
        accessorFn: (row) => (
          <AddToCartButton
            lines={[
              {
                quantity: Number(row.quantity),
                merchandiseId: row.id,
              },
            ]}
            variant="secondary"
            className="mt-2 transition focus:outline-none focus:border-primary"
          >
            <Text as="span" className="flex items-center justify-center gap-2">
              Add to Cart
            </Text>
          </AddToCartButton>
        ),
        id: 'addToCart',
        cell: (info) => info.getValue(),
        header: () => <span className="table w-full text-left"></span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: true,
    debugHeaders: true,
    debugColumns: false,
    // Provide our updateData function to our table meta
    meta: {
      updateData: (rowIndex, columnId, value) => {
        // Skip age index reset until after next rerender
        // skipAutoResetPageIndex();
        setData((old) =>
          old.map((row, index) => {
            if (index === rowIndex) {
              return {
                ...old[rowIndex]!,
                [columnId]: value,
              };
            }
            return row;
          }),
        );
      },
    },
  });

  // useEffect(() => {
  //   if (table.getState().columnFilters[0]?.id === 'fullName') {
  //     if (table.getState().sorting[0]?.id !== 'fullName') {
  //       table.setSorting([{id: 'fullName', desc: false}]);
  //     }
  //   }
  // }, [table.getState().columnFilters[0]?.id]);

  return (
    <div>
      <DebouncedInput
        value={globalFilter ?? ''}
        onChange={(value) => setGlobalFilter(String(value))}
        className="w-full p-2 my-4 transition border rounded font-lg bg-contrast focus:outline-none focus:border-black placeholder:text-primary/60"
        placeholder="Search variants..."
      />
      <div className="h-2" />
      <table className="w-full">
        <thead className="sticky z-30 h-12 border-b border-primary/20 top-24 bg-contrast/80 backdrop-blur-lg shadow-lightHeader">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <th key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {/* {header.column.getCanFilter() ? (
                          <div>
                            <Filter column={header.column} table={table} />
                          </div>
                        ) : null} */}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// function Filter({
//   column,
//   table,
// }: {
//   column: Column<any, unknown>;
//   table: Table<any>;
// }) {
//   const firstValue = table
//     .getPreFilteredRowModel()
//     .flatRows[0]?.getValue(column.id);

//   const columnFilterValue = column.getFilterValue();

//   const sortedUniqueValues = useMemo(
//     () =>
//       typeof firstValue === 'number'
//         ? []
//         : Array.from(column.getFacetedUniqueValues().keys()).sort(),
//     [column.getFacetedUniqueValues()],
//   );

//   return typeof firstValue === 'number' ? (
//     <div>
//       <div className="flex space-x-2">
//         <DebouncedInput
//           type="number"
//           min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
//           max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
//           value={(columnFilterValue as [number, number])?.[0] ?? ''}
//           onChange={(value) =>
//             column.setFilterValue((old: [number, number]) => [value, old?.[1]])
//           }
//           placeholder={`Min ${
//             column.getFacetedMinMaxValues()?.[0]
//               ? `(${column.getFacetedMinMaxValues()?.[0]})`
//               : ''
//           }`}
//           className="w-24 border rounded shadow"
//         />
//         <DebouncedInput
//           type="number"
//           min={Number(column.getFacetedMinMaxValues()?.[0] ?? '')}
//           max={Number(column.getFacetedMinMaxValues()?.[1] ?? '')}
//           value={(columnFilterValue as [number, number])?.[1] ?? ''}
//           onChange={(value) =>
//             column.setFilterValue((old: [number, number]) => [old?.[0], value])
//           }
//           placeholder={`Max ${
//             column.getFacetedMinMaxValues()?.[1]
//               ? `(${column.getFacetedMinMaxValues()?.[1]})`
//               : ''
//           }`}
//           className="w-24 border rounded shadow"
//         />
//       </div>
//       <div className="h-1" />
//     </div>
//   ) : (
//     <>
//       <datalist id={column.id + 'list'}>
//         {sortedUniqueValues.slice(0, 5000).map((value: any) => (
//           <option value={value} key={value} />
//         ))}
//       </datalist>
//       <DebouncedInput
//         type="text"
//         value={(columnFilterValue ?? '') as string}
//         onChange={(value) => column.setFilterValue(value)}
//         placeholder={`Search... (${column.getFacetedUniqueValues().size})`}
//         className="border rounded shadow w-36"
//         list={column.id + 'list'}
//       />
//       <div className="h-1" />
//     </>
//   );
// }

// A debounced input react component
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

export function ProductBulkOrderForm({
  product,
  priceOverrides,
  label,
  className,
  loading,
}: {
  product: SerializeFrom<Product>;
  priceOverrides: any;
  label?: string;
  className?: string;
  loading?: HTMLImageElement['loading'];
  onClick?: () => void;
}) {
  let cardLabel;
  const variants = product?.variants?.nodes?.map((v) => ({
    ...v,
    price: priceOverrides[v.id]?.price ?? v.price,
  }));

  const [localData, setData] = useState(() => variants);

  const cardProduct: Product = variants
    ? (product as Product)
    : getProductPlaceholder();
  if (!cardProduct?.variants?.nodes?.length) return null;

  const firstVariant = variants[0];

  if (!firstVariant) return null;
  const {image, price, compareAtPrice} = firstVariant;

  if (label) {
    cardLabel = label;
  } else if (isDiscounted(price as MoneyV2, compareAtPrice as MoneyV2)) {
    cardLabel = 'Sale';
  } else if (isNewArrival(product.publishedAt)) {
    cardLabel = 'New';
  }

  const productAnalytics: ShopifyAnalyticsProduct = {
    productGid: product.id,
    variantGid: firstVariant.id,
    name: product.title,
    variantName: firstVariant.title,
    brand: product.vendor,
    price: firstVariant.price.amount,
    quantity: 1,
  };

  return (
    <div className="flex flex-col mb-8">
      <div className={clsx('flex gap-6 items-center', className)}>
        <div className="w-20 border rounded overflow-clip aspect-square bg-primary/5">
          {image && (
            <Image
              className="aspect-[1/1] w-full object-cover fadeIn"
              widths={[160]}
              sizes="160px"
              loaderOptions={{
                crop: 'center',
                width: 160,
                height: 160,
              }}
              data={image}
              alt={image.altText || `Picture of ${product.title}`}
              loading={loading}
            />
          )}
          <Text
            as="label"
            size="fine"
            className="absolute top-0 right-0 m-4 text-right text-notice"
          >
            {cardLabel}
          </Text>
        </div>
        <div className="grid items-center">
          <Text
            className="w-full overflow-hidden whitespace-nowrap text-ellipsis "
            as="h3"
          >
            {product.title} - {product?.variants?.nodes.length} options
          </Text>
          <div className="flex items-center gap-4">
            <Text className="flex gap-4">
              <Money withoutTrailingZeros data={price!} />
              {isDiscounted(price as MoneyV2, compareAtPrice as MoneyV2) && (
                <CompareAtPrice
                  className={'opacity-50'}
                  data={compareAtPrice as MoneyV2}
                />
              )}
            </Text>
          </div>
        </div>
      </div>
      <section>
        <Table data={localData} setData={setData} />
      </section>

      {/* {firstVariant?.id && (
        <AddToCartButton
          lines={[
            {
              quantity: 1,
              merchandiseId: firstVariant.id,
            },
          ]}
          variant="secondary"
          formClass="sticky bottom-0 pb-4 bg-contrast"
          analytics={{
            products: [productAnalytics],
            totalValue: parseFloat(productAnalytics.price),
          }}
        >
          <Text
            as="span"
            className="flex items-center justify-center gap-2 mx-auto text-center"
          >
            Add to Cart
          </Text>
        </AddToCartButton>
      )} */}
    </div>
  );
}

function CompareAtPrice({
  data,
  className,
}: {
  data: MoneyV2;
  className?: string;
}) {
  const {currencyNarrowSymbol, withoutTrailingZerosAndCurrency} =
    useMoney(data);

  const styles = clsx('strike', className);

  return (
    <span className={styles}>
      {currencyNarrowSymbol}
      {withoutTrailingZerosAndCurrency}
    </span>
  );
}
