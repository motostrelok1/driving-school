import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDrivingSettings, DEFAULT_DRIVING_SETTINGS, type DrivingOption } from '@/features/schedule/useDrivingSettings'

export function AdminDrivingSettingsPage() {
 const {data,isLoading,error} = useDrivingSettings()
 const queryClient=useQueryClient()
 const [hours,setHours]=useState(56)
 const [credits,setCredits]=useState(18)
 const [options,setOptions]=useState<DrivingOption[]>(DEFAULT_DRIVING_SETTINGS.duration_options)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>{if(data){setHours(data.required_academic_hours);setCredits(data.required_credits);setOptions(data.duration_options)}},[data])
 async function save(){
  setSaving(true);setMessage('')
  const {error:saveError}=await supabase.rpc('set_driving_training_settings',{target_hours:hours,target_credits:credits,target_options:options})
  setSaving(false)
  if(saveError){setMessage(saveError.message);return}
  await queryClient.invalidateQueries({queryKey:['driving-training-settings']})
  setMessage('Настройки сохранены')
 }
 return <div className="space-y-6">
  <h1 className="text-2xl font-bold">Настройки автошколы</h1>
  <section className="space-y-4 rounded-xl border bg-white p-4">
   <h2 className="font-semibold">Программа вождения и длительность занятия</h2>
   {isLoading && <p>Загрузка…</p>}
   {error && <p role="alert" className="text-red-700">Не удалось прочитать настройки: {error.message}. Сначала требуется SQL 0058.</p>}
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm">Норма учебных часов<input className="mt-1 block w-full rounded border p-2" type="number" min="1" max="500" value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
    <label className="text-sm">Норма зачётных занятий<input className="mt-1 block w-full rounded border p-2" type="number" min="1" max="500" value={credits} onChange={e=>setCredits(Number(e.target.value))}/></label>
   </div>
   <p className="text-sm text-muted-foreground">Доступные длительности появляются в расписании у администратора и инструктора. Зачётные единицы нужны для расчёта прогресса. Изменение таблицы пересчитывает уже проведённые занятия.</p>
   {options.map((option,index)=><div key={index} className="flex flex-wrap items-end gap-3 rounded border p-3">
    <label className="text-sm">Минут<input className="mt-1 block w-28 rounded border p-2" type="number" min="15" max="240" step="15" value={option.minutes} onChange={e=>setOptions(old=>old.map((x,i)=>i===index?{...x,minutes:Number(e.target.value)}:x))}/></label>
    <label className="text-sm">Зачётных единиц<input className="mt-1 block w-32 rounded border p-2" type="number" min="1" max="20" value={option.credits} onChange={e=>setOptions(old=>old.map((x,i)=>i===index?{...x,credits:Number(e.target.value)}:x))}/></label>
    <button type="button" className="rounded border px-3 py-2 text-sm" disabled={options.length<=1} onClick={()=>setOptions(old=>old.filter((_,i)=>i!==index))}>Удалить</button>
   </div>)}
   <button type="button" className="rounded border px-3 py-2 text-sm" disabled={options.length>=12} onClick={()=>setOptions(old=>[...old,{minutes:150,credits:4}])}>Добавить длительность</button>
   <div><button type="button" className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50" disabled={saving||isLoading||!!error} onClick={()=>void save()}>{saving?'Сохранение…':'Сохранить настройки'}</button></div>
   {message && <p role="status" className="text-sm">{message}</p>}
  </section>
 </div>
}
