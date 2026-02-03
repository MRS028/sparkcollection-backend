// Update all DRAFT products to ACTIVE status
// Run this script with: mongosh your-database-name update-products-status.js

const result = db.products.updateMany(
  { status: "draft" },
  { $set: { status: "active" } },
);

print(`Updated ${result.modifiedCount} products from DRAFT to ACTIVE status`);

// Show current product statuses
print("\nCurrent product status distribution:");
db.products
  .aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ])
  .forEach((doc) => {
    print(`  ${doc._id}: ${doc.count} products`);
  });

// Show total products
const total = db.products.countDocuments({});
print(`\nTotal products in database: ${total}`);
