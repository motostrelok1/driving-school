import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DrivingOption = { minutes: number; credits: number }
export type DrivingSettings = { required_academic_hours: number; required_credits: number; duration_options: DrivingOption[] }
export const DEFAULT_DRIVING_SETTINGS: DrivingSettings = { required_academic_hours: 56, required_credits: 18, duration_options: [{minutes:60,credits:1},{minutes:90,credits:2},{minutes:120,credits:3}] }
export function useDrivingSettings() {
 return useQuery({ queryKey:['driving-training-settings'], queryFn:async () => {
  const {data,error}=await supabase.from('driving_training_settings').select('required_academic_hours,required_credits,duration_options').eq('id',true).single()
  if(error) throw error
  return data as DrivingSettings
 } })
}
export function creditsForDuration(minutes:number,settings:DrivingSettings) {
 return settings.duration_options.find(option=>option.minutes===minutes)?.credits ?? 0
}
