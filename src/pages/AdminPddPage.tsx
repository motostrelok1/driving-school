import { useEffect, useState, type ChangeEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { usePddArticle, useUpsertPddArticle } from '@/features/admin/useAdmin'
import { pddTopics } from '@/pages/pddTopics'
import type { PddArticleContent } from '@/types'

const exampleJson = `{
  "blocks": [
    {
      "type": "paragraph",
      "text": "Текст раздела ПДД."
    },
    {
      "type": "image",
      "src": "https://example.com/image.png",
      "alt": "Описание картинки",
      "caption": "Подпись под картинкой"
    }
  ]
}`

export function AdminPddPage() {
  const [topicId, setTopicId] = useState(pddTopics[0].id)
  const [jsonText, setJsonText] = useState(exampleJson)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const topic = pddTopics.find((item) => item.id === topicId) ?? pddTopics[0]
  const { data: article } = usePddArticle(topicId)
  const upsertArticle = useUpsertPddArticle()

  useEffect(() => {
    setError('')
    setSuccessMessage('')
    setJsonText(
      article?.content
        ? JSON.stringify(article.content, null, 2)
        : exampleJson
    )
  }, [article, topicId])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setJsonText(await file.text())
    setError('')
    setSuccessMessage('')
  }

  function saveArticle() {
    setError('')
    setSuccessMessage('')

    let content: PddArticleContent
    try {
      content = JSON.parse(jsonText) as PddArticleContent
    } catch {
      setError('JSON не удалось прочитать. Проверьте формат файла.')
      return
    }

    if (!Array.isArray(content.blocks)) {
      setError('В JSON должен быть массив blocks.')
      return
    }

    upsertArticle.mutate(
      {
        topicId,
        title: topic.title,
        content,
      },
      {
        onSuccess: () => setSuccessMessage('Раздел ПДД сохранен.'),
        onError: (mutationError) => setError(mutationError.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">ПДД</h1>

      <Card>
        <CardHeader>
          <CardTitle>Загрузка раздела</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={topicId}
            onChange={(event) => setTopicId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-primary"
          >
            {pddTopics.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}. {item.title}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 hover:bg-sky-100">
            <BookOpen className="h-4 w-4" />
            Загрузить JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            className="min-h-80 w-full rounded-lg border border-border p-3 font-mono text-sm"
          />

          <p className="text-sm text-muted-foreground">
            Картинки указываются блоком image. В поле src можно вставить публичный URL картинки из Supabase Storage.
          </p>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-primary">
              {successMessage}
            </p>
          ) : null}

          <Button onClick={saveArticle} isLoading={upsertArticle.isPending}>
            Сохранить
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
