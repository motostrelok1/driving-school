import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useMyFinance } from '@/features/admin/useAdmin'

function formatDate(value: string | null) {
  return value ? format(parseISO(value), 'd MMMM yyyy', { locale: ru }) : 'Не указан'
}

export function StudentPaymentPage() {
  const { data: finance, isLoading } = useMyFinance()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Расчеты</h1>

      <Card>
        <CardHeader>
          <CardTitle>Договор и сроки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Сумма договора</p>
            <p className="font-medium text-primary">
              {finance ? `${Number(finance.contract_amount).toLocaleString('ru-RU')} ₽` : 'Не указана'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Срок оплаты</p>
            <p className="font-medium text-primary">
              {formatDate(finance?.payment_due_date ?? null)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Срок рассрочки</p>
            <p className="font-medium text-primary">
              {formatDate(finance?.installment_due_date ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
