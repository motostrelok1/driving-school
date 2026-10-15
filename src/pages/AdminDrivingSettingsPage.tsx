import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type Option = { minutes:number; academic_hours:number; kind:'trial'|'standard' }
type Category = { id:string; name:string; academic_hours:number; duration_options:Option[]; short_label:string; is_default:boolean; position:number }
const defaults:Option[]=[{minutes:60,academic_hours:0,kind:'trial'},{minutes:90,academic_hours:2,kind:'standard'},{minutes:120,academic_hours:3,kind:'standard'}]
export function AdminDrivingSettingsPage(){
 const qc=useQueryClient()
 const {data:categories=[],error,isLoading}=useQuery({queryKey:['driving-categories'],queryFn:async()=>{
  const {data,error}=await supabase.from('driving_course_categories').select('id,name,academic_hours,duration_options,short_label,is_default,position').order('position')
  if(error)throw error
  return data as Category[]
 }})
 const [active,setActive]=useState('')
 const [name,setName]=useState('')
 const [hours,setHours]=useState(0)
 const [shortLabel,setShortLabel]=useState('B')
 const [options,setOptions]=useState<Option[]>(defaults)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const selected=categories.find(c=>c.id===active)
 useEffect(()=>{if(!active&&categories.length)setActive(categories[0].id)},[categories,active])
 useEffect(()=>{if(selected){setName(selected.name);setHours(selected.academic_hours);setShortLabel(selected.short_label);setOptions(selected.duration_options);setMessage('')}else if(active==='new'){setName('');setHours(0);setShortLabel('B');setOptions(defaults.map(x=>({...x})));setMessage('')}},[active,selected])
 async function save(){
  setSaving(true);setMessage('')
  const {data,error}=await supabase.rpc('save_driving_course_category',{target_id:active==='new'?null:active,target_name:name,target_hours:hours,target_options:options})
  setSaving(false)
  if(error){setMessage(error.message);return}
  const {error:labelError}=await supabase.rpc('set_driving_course_short_label',{target_id:data,target_label:shortLabel})
  if(labelError){setMessage('Программа сохранена, но обозначение не сохранено: '+labelError.message);return}
  await qc.invalidateQueries({queryKey:['driving-categories']})
  setActive(data as string);setMessage('Сохранено')
 }
 async function remove(){
  if(!selected||selected.is_default||!window.confirm('Удалить категорию?'))return
  setSaving(true)
  const {error}=await supabase.rpc('delete_driving_course_category',{target_id:selected.id})
  setSaving(false)
  if(error){setMessage(error.message);return}
  setActive('');await qc.invalidateQueries({queryKey:['driving-categories']})
 }
 return <div className="space-y-5">
  <h1 className="text-2xl font-bold">Настройки автошколы</h1>
  <p className="text-sm text-muted-foreground">Категории обучения. Пока они не назначены курсантам, расчёт действующей истории продолжает использовать прежние глобальные настройки.</p>
  {isLoading&&<p>Загрузка…</p>}
  {error&&<p role="alert" className="text-red-700">Не удалось загрузить категории. Проверьте SQL 0059: {error.message}</p>}
  <div className="flex flex-wrap gap-2">
   {categories.map(c=><button key={c.id} type="button" onClick={()=>setActive(c.id)} className={`rounded-lg border px-4 py-2 text-sm ${active===c.id?'border-primary bg-primary text-white':'bg-white'}`}>{c.name}</button>)}
   <button type="button" className={`rounded-lg border px-4 py-2 text-sm ${active==='new'?'bg-primary text-white':'bg-white'}`} onClick={()=>setActive('new')}>+ Добавить</button>
  </div>
  {(selected||active==='new')&&<section className="space-y-4 rounded-xl border bg-white p-4">
   <h2 className="font-semibold">{active==='new'?'Новая категория':selected?.name}</h2>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Название категории<input className="mt-1 block w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)} maxLength={60}/></label>
    <label className="text-sm">Норма академических часов<input className="mt-1 block w-full rounded border p-2" type="number" min={0} max={500} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
   </div>
   <label className="block text-sm">Обозначение на кнопке в карточке курсанта<input className="mt-1 block w-28 rounded border p-2" maxLength={12} value={shortLabel} onChange={e=>setShortLabel(e.target.value)}/></label>
   <h3 className="font-semibold">Варианты занятий</h3>
   {options.map((o,i)=><div key={i} className="flex flex-wrap items-end gap-2 rounded border p-3">
    <label className="text-sm">Минут<input className="mt-1 block w-24 rounded border p-2" type="number" min={15} max={240} step={15} value={o.minutes} onChange={e=>setOptions(xs=>xs.map((x,j)=>j===i?{...x,minutes:Number(e.target.value)}:x))}/></label>
    <label className="text-sm">Тип<select className="mt-1 block rounded border p-2" value={o.kind} onChange={e=>setOptions(xs=>xs.map((x,j)=>j===i?{...x,kind:e.target.value as Option['kind'],academic_hours:e.target.value==='trial'?0:x.academic_hours}:x))}><option value="standard">Обычное</option><option value="trial">Пробное / подарочное</option></select></label>
    <label className="text-sm">Зачёт акад. часов<input className="mt-1 block w-28 rounded border p-2" type="number" min={0} max={10} disabled={o.kind==='trial'} value={o.academic_hours} onChange={e=>setOptions(xs=>xs.map((x,j)=>j===i?{...x,academic_hours:Number(e.target.value)}:x))}/></label>
    <button type="button" className="rounded border px-3 py-2 text-sm" disabled={options.length<=1} onClick={()=>setOptions(xs=>xs.filter((_,j)=>j!==i))}>Удалить</button>
   </div>)}
   <button type="button" className="rounded border px-3 py-2 text-sm" disabled={options.length>=12} onClick={()=>setOptions(xs=>[...xs,{minutes:150,academic_hours:4,kind:'standard'}])}>+ Длительность</button>
   <div className="flex flex-wrap gap-2">
    <button className="rounded bg-primary px-4 py-2 text-white" disabled={saving||!!error} onClick={()=>void save()}>{saving?'Сохранение…':'Сохранить'}</button>
    {selected&&!selected.is_default&&<button className="rounded border border-red-300 px-4 py-2 text-red-700" disabled={saving} onClick={()=>void remove()}>Удалить категорию</button>}
   </div>
   {message&&<p role="status" className="text-sm">{message}</p>}
  </section>}
 </div>
}
