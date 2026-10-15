import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function AdminStudentCourseSelect({studentId}:{studentId:string}) {
 const qc=useQueryClient()
 const categories=useQuery({queryKey:['driving-categories'],queryFn:async()=>{
  const {data,error}=await supabase.from('driving_course_categories').select('id,name,academic_hours').order('position')
  if(error)throw error
  return data??[]
 }})
 const assigned=useQuery({queryKey:['student-course',studentId],queryFn:async()=>{
  const {data,error}=await supabase.from('student_driving_courses').select('category_id').eq('student_id',studentId).maybeSingle()
  if(error)throw error
  return data?.category_id??''
 }})
 const [selected,setSelected]=useState('')
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>{setSelected(assigned.data??'')},[assigned.data])
 async function save(){
  if(!selected)return
  setSaving(true);setMessage('')
  const {error}=await supabase.rpc('set_student_driving_course',{target_student_id:studentId,target_category_id:selected})
  setSaving(false)
  if(error){setMessage(error.message);return}
  await qc.invalidateQueries({queryKey:['student-course',studentId]})
  setMessage('Категория обучения сохранена')
 }
 return <div className="my-3 rounded-lg border p-3 space-y-2">
  <p className="text-sm font-medium">Программа вождения</p>
  {(categories.error||assigned.error)&&<p role="alert" className="text-sm text-red-700">Не удалось загрузить категории. Проверьте SQL 0059 и 0060.</p>}
  <div className="flex flex-wrap gap-2">
   <select aria-label="Категория обучения" className="rounded border p-2 text-sm" value={selected} onChange={e=>setSelected(e.target.value)}>
    <option value="">Не назначена</option>
    {(categories.data??[]).map(c=><option key={c.id} value={c.id}>{c.name} — {c.academic_hours} акад. ч</option>)}
   </select>
   <button type="button" className="rounded bg-primary px-3 py-2 text-sm text-white disabled:opacity-50" disabled={saving||!selected||!!categories.error||!!assigned.error||selected===assigned.data} onClick={()=>void save()}>Сохранить программу</button>
  </div>
  {message&&<p className="text-sm" role="status">{message}</p>}
  <p className="text-xs text-muted-foreground">Назначение программы не изменяет историю занятий. Пересчёт академических часов подключим отдельно.</p>
 </div>
}
