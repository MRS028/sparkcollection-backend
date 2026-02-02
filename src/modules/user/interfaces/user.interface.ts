import { Types } from "mongoose";

// Enums
export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  CUSTOMER = "customer",
  ADMIN = "admin",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
  PENDING_VERIFICATION = "pending_verification",
}

// Interfaces
export interface IAuthProvider {
  provider: "google" | "facebook" | "twitter" | "github" | "credentials";
  providerId: string;
}

export interface IAddress {
  type?: "shipping" | "billing";
  firstName?: string;
  lastName?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  zila?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export interface IUser {
  _id?: Types.ObjectId;
  name?: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  picture?: string;
  avatar?: string;
  address?: string;
  addresses?: IAddress[];
  isDeleted?: boolean;
  isActive?: UserStatus;
  isVerified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  role: Role;
  status?: UserStatus;
  auths?: IAuthProvider[];
  lastLogin?: Date;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  fullName?: string;
  comparePassword?(candidatePassword: string): Promise<boolean>;
}
