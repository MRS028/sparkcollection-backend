export { Product, ProductStatus } from "./models/Product.model.js";
export { Category } from "./models/Category.model.js";
export {
  InventoryMovement,
  StockAlert,
  InventoryMovementType,
} from "./models/Inventory.model.js";
export { default as productRoutes } from "./routes/product.routes.js";
export { productService } from "./services/product.service.js";
