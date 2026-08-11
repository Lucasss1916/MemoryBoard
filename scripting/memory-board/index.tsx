import {
  Navigation,
  NavigationStack,
  Script,
  Storage,
  List,
  Section,
  VStack,
  HStack,
  Text,
  Image,
  Picker,
  Button,
  TextField,
  ProgressView,
  Spacer,
  useState,
  useEffect,
  fetch,
} from "scripting"

// ==== 配置 ====
// 服务端地址与小组件令牌存在私有存储里,首次使用需在页面底部「设置」里填。
// token 在「网页端 → 设置」里生成。
const KEY_BASE = "mb.baseUrl"
const KEY_TOKEN = "mb.token"

// ==== API 返回的数据类型(与 /api/widget 对齐) ====
type Board = { id: string; name: string; kind: string }
type Message = {
  board: string
  boardId: string
  boardKind: string
  author: string
  content: string
  hasImage: boolean
  imageUrl: string | null
  thumbUrl: string | null
  createdAt: string
}
type Capsule = {
  board: string
  boardId: string
  boardKind: string
  author: string
  title: string
  unlocked: boolean
  unlockAt: string
  content: string | null
  hasImage: boolean
  imageUrl: string | null
  thumbUrl: string | null
}
type Anniversary = {
  title: string
  board: string
  boardId: string
  boardKind: string
  date: string
  daysUntil: number
}
type WidgetData = {
  user: string
  boards: Board[]
  selectedBoardId: string | null
  messages: Message[]
  anniversaries: Anniversary[]
  capsules: Capsule[]
  generatedAt: string
}

// 留言板类型 → emoji + 中文标签,用于视觉区分不同类型的板
function kindMeta(kind: string): { emoji: string; label: string } {
  switch (kind) {
    case "LOVER":
      return { emoji: "💗", label: "恋人" }
    case "FAMILY":
      return { emoji: "🏠", label: "家人" }
    case "FRIEND":
      return { emoji: "🤝", label: "朋友" }
    default:
      return { emoji: "📌", label: "其它" }
  }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => (n < 10 ? "0" + n : "" + n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function daysUntilText(n: number): string {
  if (n === 0) return "就是今天 🎉"
  if (n === 1) return "还有 1 天"
  return `还有 ${n} 天`
}

// ============ 设置页:填服务端地址与令牌 ============
function SettingsView({
  base,
  token,
  onSaved,
}: {
  base: string
  token: string
  onSaved: (base: string, token: string) => void
}) {
  const dismiss = Navigation.useDismiss()
  const [b, setB] = useState(base)
  const [t, setT] = useState(token)

  return (
    <NavigationStack>
      <List navigationTitle="设置" navigationBarTitleDisplayMode="inline">
        <Section
          header={<Text>服务端</Text>}
          footer={
            <Text>
              地址形如 https://你的域名 (末尾不要带斜杠)。令牌在网页端「设置」里生成。
            </Text>
          }
        >
          <TextField
            title="地址"
            value={b}
            onChanged={setB}
            prompt="https://your-domain.com"
          />
          <TextField
            title="令牌"
            value={t}
            onChanged={setT}
            prompt="widgetToken"
          />
        </Section>
        <Section>
          <Button
            action={() => {
              const cleanBase = b.trim().replace(/\/+$/, "")
              onSaved(cleanBase, t.trim())
              dismiss()
            }}
          >
            <Text>保存</Text>
          </Button>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ============ 主页面 ============
function MainView() {
  const [base, setBase] = useState<string>(() => Storage.get<string>(KEY_BASE) ?? "")
  const [token, setToken] = useState<string>(() => Storage.get<string>(KEY_TOKEN) ?? "")
  const [data, setData] = useState<WidgetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // "" 表示全部留言板;否则是某个 boardId(隔离到单个板)
  const [selected, setSelected] = useState<string>("")

  async function load(boardId: string) {
    if (!base || !token) {
      setShowSettings(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = [`token=${encodeURIComponent(token)}`, "limit=20", "thumb=200"]
      if (boardId) params.push(`board=${encodeURIComponent(boardId)}`)
      const url = `${base}/api/widget?${params.join("&")}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as WidgetData
      setData(json)
    } catch (e) {
      setError(String((e as Error)?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  // 首次加载 & 切换留言板时重新拉取
  useEffect(() => {
    load(selected)
  }, [selected, base, token])

  async function openSettings() {
    await Navigation.present({
      element: (
        <SettingsView
          base={base}
          token={token}
          onSaved={(nb, nt) => {
            Storage.set(KEY_BASE, nb)
            Storage.set(KEY_TOKEN, nt)
            setBase(nb)
            setToken(nt)
          }}
        />
      ),
    })
  }

  const boards = data?.boards ?? []
  const messages = data?.messages ?? []
  const capsules = data?.capsules ?? []
  const anniversaries = data?.anniversaries ?? []

  return (
    <NavigationStack>
      <List
        navigationTitle={data ? `${data.user} 的留言板` : "留言板"}
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarTrailing: [
            <Button action={openSettings}>
              <Image systemName="gearshape" />
            </Button>,
            <Button action={() => load(selected)}>
              <Image systemName="arrow.clockwise" />
            </Button>,
          ],
        }}
      >
        {/* 留言板选择:全部 or 指定某个(实现按板隔离) */}
        <Section header={<Text>留言板</Text>}>
          <Picker
            title="选择留言板"
            value={selected}
            onChanged={(v) => setSelected(v as string)}
            pickerStyle="menu"
          >
            <Text tag="">全部</Text>
            {boards.map((b) => {
              const m = kindMeta(b.kind)
              return (
                <Text tag={b.id} key={b.id}>
                  {m.emoji} {b.name}（{m.label}）
                </Text>
              )
            })}
          </Picker>
        </Section>

        {loading && (
          <Section>
            <HStack>
              <ProgressView />
              <Text>加载中…</Text>
            </HStack>
          </Section>
        )}

        {error && (
          <Section header={<Text>出错了</Text>}>
            <Text foregroundStyle="systemRed">{error}</Text>
            <Button action={openSettings}>
              <Text>检查设置</Text>
            </Button>
          </Section>
        )}

        {/* 留言 */}
        {messages.length > 0 && (
          <Section header={<Text>留言 · {messages.length}</Text>}>
            {messages.map((m, i) => {
              const meta = kindMeta(m.boardKind)
              return (
                <VStack alignment="leading" spacing={6} key={"msg" + i}>
                  <HStack>
                    <Text font="caption" foregroundStyle="secondaryLabel">
                      {meta.emoji} {m.board} · {m.author}
                    </Text>
                    <Spacer />
                    <Text font="caption" foregroundStyle="secondaryLabel">
                      {fmtDateTime(m.createdAt)}
                    </Text>
                  </HStack>
                  <Text>{m.content}</Text>
                  {m.hasImage && m.thumbUrl && (
                    <Image
                      imageUrl={m.thumbUrl}
                      resizable
                      scaleToFit
                      frame={{ maxWidth: 240, maxHeight: 240 }}
                      clipShape={{ type: "rect", cornerRadius: 10 }}
                      placeholder={<Text foregroundStyle="secondaryLabel">图片加载中…</Text>}
                    />
                  )}
                </VStack>
              )
            })}
          </Section>
        )}

        {/* 时间胶囊 */}
        {capsules.length > 0 && (
          <Section header={<Text>时间胶囊 · {capsules.length}</Text>}>
            {capsules.map((c, i) => {
              const meta = kindMeta(c.boardKind)
              return (
                <VStack alignment="leading" spacing={6} key={"cap" + i}>
                  <HStack>
                    <Image systemName={c.unlocked ? "lock.open" : "lock.fill"} />
                    <Text font="headline">{c.title}</Text>
                    <Spacer />
                    <Text font="caption" foregroundStyle="secondaryLabel">
                      {meta.emoji} {c.board}
                    </Text>
                  </HStack>
                  {c.unlocked ? (
                    <VStack alignment="leading" spacing={6}>
                      {c.content != null && <Text>{c.content}</Text>}
                      {c.hasImage && c.thumbUrl && (
                        <Image
                          imageUrl={c.thumbUrl}
                          resizable
                          scaleToFit
                          frame={{ maxWidth: 240, maxHeight: 240 }}
                          clipShape={{ type: "rect", cornerRadius: 10 }}
                          placeholder={<Text foregroundStyle="secondaryLabel">图片加载中…</Text>}
                        />
                      )}
                      <Text font="caption" foregroundStyle="secondaryLabel">
                        来自 {c.author}
                      </Text>
                    </VStack>
                  ) : (
                    <Text foregroundStyle="secondaryLabel">
                      🔒 未解锁 · {fmtDateTime(c.unlockAt)} 开启
                    </Text>
                  )}
                </VStack>
              )
            })}
          </Section>
        )}

        {/* 纪念日 */}
        {anniversaries.length > 0 && (
          <Section header={<Text>纪念日 · {anniversaries.length}</Text>}>
            {anniversaries.map((a, i) => {
              const meta = kindMeta(a.boardKind)
              return (
                <HStack key={"ann" + i}>
                  <VStack alignment="leading" spacing={2}>
                    <Text font="headline">{a.title}</Text>
                    <Text font="caption" foregroundStyle="secondaryLabel">
                      {meta.emoji} {a.board} · {a.date}
                    </Text>
                  </VStack>
                  <Spacer />
                  <Text foregroundStyle="systemPink">{daysUntilText(a.daysUntil)}</Text>
                </HStack>
              )
            })}
          </Section>
        )}

        {/* 空状态 */}
        {!loading && !error && data &&
          messages.length === 0 &&
          capsules.length === 0 &&
          anniversaries.length === 0 && (
            <Section>
              <Text foregroundStyle="secondaryLabel">这个范围内还没有内容。</Text>
            </Section>
          )}

        {/* 没配置过 */}
        {!base || !token ? (
          <Section footer={<Text>先在「设置」里填服务端地址和令牌。</Text>}>
            <Button action={openSettings}>
              <Text>去设置</Text>
            </Button>
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present({
    element: <MainView />,
  })
  Script.exit()
}

run()
