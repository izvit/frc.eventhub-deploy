export interface User {
  id: number
  name: string
  email?: string
  type?: string
  role?: string
  active?: boolean
}

export interface UserRead extends User {
  // Add additional fields returned by backend if needed
}
