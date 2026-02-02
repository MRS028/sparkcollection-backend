import { model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "../../../config/index.js";
import {
  IUser,
  IAddress,
  IAuthProvider,
  Role,
  UserStatus,
} from "../interfaces/user.interface";

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { versionKey: false, _id: false },
);

const addressSchema = new Schema<IAddress>(
  {
    type: { type: String, enum: ["shipping", "billing"], default: "shipping" },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    company: { type: String, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    zila: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "BD" },
    phone: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.CUSTOMER,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
    },
    phone: { type: String, trim: true },
    picture: { type: String },
    avatar: { type: String },
    address: { type: String },
    addresses: [addressSchema],
    isDeleted: { type: Boolean, default: false },
    isActive: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    auths: [authProviderSchema],
    lastLogin: { type: Date },
    tenantId: { type: String, default: config.multiTenant.defaultTenantId },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Virtual for full name
userSchema.virtual("fullName").get(function (this: IUser) {
  return this.firstName && this.lastName
    ? `${this.firstName} ${this.lastName}`
    : this.name;
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(config.bcrypt.saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model<IUser>("User", userSchema);
