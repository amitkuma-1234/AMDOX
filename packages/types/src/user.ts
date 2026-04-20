/**
 * User-related type definitions shared across apps.
 */

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UserProfile extends Pick<User, "id" | "email" | "firstName" | "lastName" | "avatarUrl"> {
  fullName: string;
  roles: UserRole[];
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface CreateUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive?: boolean;
}
