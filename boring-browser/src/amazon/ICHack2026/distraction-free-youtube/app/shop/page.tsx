"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface Product {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
}

const mockProducts: Product[] = [
  { id: "1", name: "Classic White T-Shirt", brand: "Everlane", price: "$28", category: "Clothing" },
  { id: "2", name: "Slim Fit Jeans", brand: "Levi's", price: "$89", category: "Clothing" },
  { id: "3", name: "Running Shoes", brand: "Nike", price: "$120", category: "Footwear" },
  { id: "4", name: "Wireless Headphones", brand: "Sony", price: "$249", category: "Electronics" },
  { id: "5", name: "Ceramic Coffee Mug", brand: "West Elm", price: "$14", category: "Home" },
  { id: "6", name: "Wool Sweater", brand: "Uniqlo", price: "$49", category: "Clothing" },
  { id: "7", name: "Leather Wallet", brand: "Bellroy", price: "$89", category: "Accessories" },
  { id: "8", name: "Stainless Steel Water Bottle", brand: "Hydro Flask", price: "$35", category: "Home" },
  { id: "9", name: "Cotton Hoodie", brand: "Carhartt", price: "$65", category: "Clothing" },
  { id: "10", name: "Minimalist Watch", brand: "Timex", price: "$75", category: "Accessories" },
  { id: "11", name: "Canvas Backpack", brand: "Fjallraven", price: "$110", category: "Accessories" },
  { id: "12", name: "Desk Lamp", brand: "IKEA", price: "$29", category: "Home" },
];

const categories = ["All", "Clothing", "Footwear", "Electronics", "Home", "Accessories"];

export default function ShopPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (selectedProduct) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <button
            onClick={() => setSelectedProduct(null)}
            className="text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            Back to products
          </button>

          <div className="bg-card rounded-2xl border border-border p-8">
            <p className="text-sm text-muted-foreground mb-2">{selectedProduct.brand}</p>
            <h1 className="text-xl font-medium text-foreground mb-4">{selectedProduct.name}</h1>
            <p className="text-lg text-foreground mb-6">{selectedProduct.price}</p>
            
            <div className="border-t border-border pt-6 mt-6">
              <h2 className="text-sm font-medium text-foreground mb-3">Details</h2>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>Category: {selectedProduct.category}</li>
                <li>Brand: {selectedProduct.brand}</li>
                <li>Ships in 3-5 business days</li>
              </ul>
            </div>

            <button className="w-full mt-8 py-3 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity">
              Add to cart
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-1">CleanShop</h1>
          <p className="text-muted-foreground">Just the products, no pressure.</p>
        </header>

        <div className="mb-8 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-card border border-border rounded-full pl-12 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-muted-foreground transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                selectedCategory === category
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="text-left p-4 bg-card rounded-2xl border border-border hover:border-muted-foreground/50 transition-colors"
            >
              <h3 className="text-foreground leading-snug mb-2">{product.name}</h3>
              <p className="text-sm text-muted-foreground">
                {product.brand} · {product.price}
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
