/**
 * src/models/User.ts
 *
 * Mongoose model for authenticated users.
 * Coexists with the existing community identity system (client-generated UUID)
 * which is used for unauthenticated actions like asking questions.
 */

import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;