/**
 * Coupon Model
 * Manages discount coupons and promotional codes
 */

import mongoose, { Schema, Document, Types } from "mongoose";

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
}

export enum CouponStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
}

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount: number;
  startDate: Date;
  endDate: Date;
  totalUsageLimit?: number;
  usagePerUser?: number;
  totalUsed: number;
  status: CouponStatus;
  applicableProducts?: Types.ObjectId[];
  applicableCategories?: Types.ObjectId[];
  tenantId: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isValid(): boolean;
  canBeUsedBy(userId: string, usedCount: number): boolean;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalUsageLimit: {
      type: Number,
      min: 1,
    },
    usagePerUser: {
      type: Number,
      default: 1,
      min: 1,
    },
    totalUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(CouponStatus),
      default: CouponStatus.ACTIVE,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
couponSchema.index({ code: 1, tenantId: 1 }, { unique: true });
couponSchema.index({ status: 1, startDate: 1, endDate: 1 });
couponSchema.index({ tenantId: 1, status: 1 });

// Validation
couponSchema.pre("save", function (next) {
  // Validate discount value based on type
  if (this.discountType === DiscountType.PERCENTAGE) {
    if (this.discountValue > 100) {
      throw new Error("Percentage discount cannot exceed 100%");
    }
  }

  // Validate dates
  if (this.endDate <= this.startDate) {
    throw new Error("End date must be after start date");
  }

  // Auto-update status based on dates
  const now = new Date();
  if (this.endDate < now) {
    this.status = CouponStatus.EXPIRED;
  }

  next();
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function (): boolean {
  const now = new Date();

  if (this.status !== CouponStatus.ACTIVE) {
    return false;
  }

  if (now < this.startDate || now > this.endDate) {
    return false;
  }

  if (this.totalUsageLimit && this.totalUsed >= this.totalUsageLimit) {
    return false;
  }

  return true;
};

// Method to check if user can use the coupon
couponSchema.methods.canBeUsedBy = function (
  userId: string,
  usedCount: number,
): boolean {
  if (!this.isValid()) {
    return false;
  }

  if (this.usagePerUser && usedCount >= this.usagePerUser) {
    return false;
  }

  return true;
};

export const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);
