/**
 * Category Model
 * Hierarchical category structure
 */

import mongoose, { Schema, Document, Types, Model } from "mongoose";
import slugify from "slugify";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  parent?: Types.ObjectId;
  ancestors: Types.ObjectId[];
  level: number;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  productCount: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    image: {
      type: String,
    },
    icon: {
      type: String,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    ancestors: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    seoTitle: {
      type: String,
      maxlength: 70,
    },
    seoDescription: {
      type: String,
      maxlength: 160,
    },
    productCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
categorySchema.index({ parent: 1, sortOrder: 1 });
categorySchema.index({ tenantId: 1, isActive: 1 });
categorySchema.index({ level: 1, isActive: 1 });

// Pre-save middleware
categorySchema.pre("save", async function (next) {
  // Generate slug
  if (this.isModified("name") || !this.slug) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    const Category = this.constructor as Model<ICategory>;
    while (await Category.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  // Update level and ancestors
  if (this.isModified("parent")) {
    if (this.parent) {
      const Category = this.constructor as Model<ICategory>;
      const parentCat = await Category.findById(this.parent);
      if (parentCat) {
        this.ancestors = [...parentCat.ancestors, parentCat._id];
        this.level = parentCat.level + 1;
      }
    } else {
      this.ancestors = [];
      this.level = 0;
    }
  }

  next();
});

// Virtual for children
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Virtual for full path
categorySchema.virtual("fullPath").get(function () {
  return this.ancestors && this.ancestors.length > 0
    ? `${this.ancestors.join("/")}/${this._id}`
    : this._id.toString();
});

export const Category = mongoose.model<ICategory>("Category", categorySchema);
