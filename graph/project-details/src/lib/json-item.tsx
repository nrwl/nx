export interface JsonItemProps {
  key: string;
  value: any;
}
export function JsonItem() {}

// export interface JsonItemListProps {
//     jsonData: any
// }
// export function JsonItemList({jsonData}: JsonItemListProps) {
//     Object.entries(jsonData).map(([key, value]) => {
//         if (typeof value === 'object') {
//             return <JsonItemList jsonData={value} />
//         } else {
//             return <JsonItem key={key} value={value} />
//         }
//     }
// }
