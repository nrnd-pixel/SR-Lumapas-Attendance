-- Phase 6A foreign-key index coverage verifier.
-- Returns zero rows only when every Attendance/Attendance-private foreign key
-- has a valid, ready, non-partial index whose leading columns cover the FK.

with attendance_fks as (
  select
    con.conrelid,
    n.nspname as schema_name,
    c.relname as table_name,
    con.conname as constraint_name,
    con.conkey
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and n.nspname in ('attendance', 'attendance_private')
),
uncovered as (
  select
    fk.schema_name,
    fk.table_name,
    fk.constraint_name
  from attendance_fks fk
  where not exists (
    select 1
    from pg_index i
    where i.indrelid = fk.conrelid
      and i.indisvalid
      and i.indisready
      and i.indpred is null
      and i.indexprs is null
      and (i.indkey::smallint[])[0:cardinality(fk.conkey)-1] = fk.conkey
  )
)
select schema_name, table_name, constraint_name
from uncovered
order by schema_name, table_name, constraint_name;
