import { db } from "@/db";
import { products } from "@/db/schema";
import { ProductsClient } from "@/components/products-client";

export default async function ProductsPage() {
  const allProducts = await db.select().from(products).orderBy(products.name);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Products</h1>
      <ProductsClient products={allProducts} />
    </div>
  );
}
