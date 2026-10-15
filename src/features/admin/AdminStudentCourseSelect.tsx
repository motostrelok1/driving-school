import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
type Category={id:string;name:string;short_label:string;academic_hours:number}
export function AdminStudentCourseSelect({studentId,onClose}:{studentId:string;onClose:()=>void}) {
 const qc=useQueryClient()
 const categories=useQuery({queryKey:['driving-categories'],queryFn:async()=>{
  const {data,error}=await supabase.from('driving_course_categories').select('id,name,short_label,academic_hours').order('position')
  if(error)throw error
  return (data??[]) as Category[]
 }})
 const assigned=useQuery({queryKey:['student-course',studentId],queryFn:async()=>{
  const {data,error}=await supabase.from('student_driving_courses').select('category_id').eq('student_id',studentId).maybeSingle()
  if(error)throw error
  return data?.category_id??''
 }})
 const [selected,setSelected]=useState('')
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>{if(categories.data){setSelected(assigned.data||categories.data.find(c=>c.name==='B (МКПП)')?.id||categories.data[0]?.id||'')}},[assigned.data,categories.data])
 async function save(){
  if(!selected)return
  setSaving(true);setMessage('')
  const {error}=await supabase.rpc('set_student_driving_course',{target_student_id:studentId,target_category_id:selected})
  setSaving(false)
  if(error){setMessage(error.message);return}
  await Promise.all([
   qc.invalidateQueries({queryKey:['student-course',studentId]}),
   qc.invalidateQueries({queryKey:['student-course-badge',studentId]}),
  ])
  onClose()
 }
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-lg" role="dialog" aria-modal="true" aria-label="Программа вождения">
   <h2 className="text-lg font-semibold">Программа вождения</h2>
   <p className="text-sm text-muted-foreground">Выберите категорию обучения курсанта. Если категория ещё не назначена, по умолчанию предлагается B (МКПП).</p>
   {categories.error||assigned.error?<p role="alert" className="text-sm text-red-700">Не удалось загрузить категории. Проверьте SQL 0059–0061.</p>:null}
   <div className="space-y-2">{(categories.data??[]).map(c=><label key={c.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
    <input type="radio" name={studentId+'course'} value={c.id} checked={selected===c.id} onChange={()=>setSelected(c.id)}/>
    <strong className="min-w-10">{c.short_label}</strong><span>{c.name} — {c.academic_hours} акад. ч</span>
   </label>)}</div>
   <div className="flex justify-end gap-2">
    <button className="rounded border px-4 py-2 text-sm" onClick={onClose}>Отмена</button>
    <button className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!selected||saving||!!categories.error||!!assigned.error} onClick={()=>void save()}>{saving?'Сохранение…':'Сохранить'}</button>
   </div>
   {message&&<p role="alert" className="text-sm text-red-700">{message}</p>}
  </div>
 </div>
}
export function StudentCourseBadge({studentId,onClick}:{studentId:string;onClick:()=>void}){
 const {data}=useQuery({queryKey:['student-course-badge',studentId],queryFn:async()=>{
  const {data,error}=await supabase.from('student_driving_courses').select('category_id,driving_course_categories(name,short_label)').eq('student_id',studentId).maybeSingle()
  if(error)throw error
  const category=data?.driving_course_categories as {name:string;short_label:string}|null|undefined
  return category??null
 }})
 return <button type="button" className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold text-primary hover:bg-muted" title={data?.name??'Выбрать программу вождения'} aria-label="Выбрать программу вождения" onClick={onClick}>{data?.short_label??'B(М)'}</button>
}
