/** Fields already selected by the membership page. No persistence contract is implied. */
export interface MemberRecord {
  id: string;
  full_name: string;
  gender: "laki_laki" | "perempuan" | null;
  phone: string | null;
  created_at: string;
}

export function memberCompleteness(member: MemberRecord): "complete" | "incomplete" {
  return member.gender ? "complete" : "incomplete";
}
