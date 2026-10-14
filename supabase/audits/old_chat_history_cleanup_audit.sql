-- READ ONLY. Run in Supabase SQL Editor to assess a complete reset of historical
-- messaging. Does not delete or update any rows.
-- Save both results before designing a destructive transaction.

SELECT 'message_threads' AS relation, count(*) AS rows_to_review FROM public.message_threads
UNION ALL SELECT 'messages', count(*) FROM public.messages
UNION ALL SELECT 'message_recipients', count(*) FROM public.message_recipients
UNION ALL SELECT 'message_thread_participants', count(*) FROM public.message_thread_participants
UNION ALL SELECT 'instructor_chat_tasks', count(*) FROM public.instructor_chat_tasks
ORDER BY relation;

-- Every foreign key referencing a messaging table, including outside tables.
-- A reset must account for these constraints explicitly, not use CASCADE blindly.
SELECT
  con.conname AS constraint_name,
  con.conrelid::regclass::text AS referencing_table,
  con.confrelid::regclass::text AS referenced_table,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
WHERE con.contype = 'f'
  AND con.confrelid IN (
    'public.message_threads'::regclass,
    'public.messages'::regclass,
    'public.message_recipients'::regclass,
    'public.message_thread_participants'::regclass,
    'public.instructor_chat_tasks'::regclass
  )
ORDER BY referenced_table, referencing_table, constraint_name;
