/**
 * Shipping Module Exports
 */

export * from "./models/Shipment.model.js";
export * from "./services/shipping.service.js";
export * from "./controllers/shipping.controller.js";
export * from "./routes/shipping.routes.js";
// Note: validators export types that may overlap with service, use service types for internal use
export {
  createShipmentSchema,
  getShipmentSchema,
  getByTrackingSchema,
  updateStatusSchema,
  shipmentFiltersSchema,
} from "./validators/shipping.validator.js";
