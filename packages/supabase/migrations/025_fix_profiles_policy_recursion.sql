-- Fix: "infinite recursion detected in policy for relation profiles" when a customer saves their name.
-- The old WITH CHECK re-queried profiles inside a profiles policy. Role changes are already blocked by the
-- column-level grant in migration 010 (authenticated may update only full_name), so the subquery is unnecessary.
drop policy if exists "profiles: users update own" on public.profiles;
create policy "profiles: users update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
