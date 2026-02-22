// Query key factory — uid first so invalidateQueries({ queryKey: [uid] }) clears all user data
export const QUERY_KEYS = {
  all:          (userId: string) => [userId] as const,
  transactions: (userId: string) => [userId, 'transactions'] as const,
  accounts:     (userId: string) => [userId, 'accounts']     as const,
  categories:   (userId: string) => [userId, 'categories']   as const,
  tags:         (userId: string) => [userId, 'tags']         as const,
  userSettings: (userId: string) => [userId, 'userSettings'] as const,
} as const;
