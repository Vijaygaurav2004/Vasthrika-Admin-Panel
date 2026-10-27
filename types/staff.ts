export interface StaffMember {
  id: string;
  email: string;
  name: string;
  active: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
}
