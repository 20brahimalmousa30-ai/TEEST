export type DbSession = {
  phone: string;
  name: string;
  role: string;
  isOwner: boolean;
  supervisorId: string | null;
  studentId: string | null;
  landing: string;
};

export type LoginResult = { ok: true; session: DbSession } | { ok: false };
