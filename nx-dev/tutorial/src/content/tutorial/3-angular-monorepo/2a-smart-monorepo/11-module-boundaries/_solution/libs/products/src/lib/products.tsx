import styles from './products.module.css';

// This import is not allowed 👇
import { Orders } from '@angular-monorepo/orders';

export function Products() {
  return (
    <div className={styles['container']}>
      <h1>Welcome to Products!</h1>
      <p>This is a change. 👋</p>
    </div>
  );
}

export default Products;
