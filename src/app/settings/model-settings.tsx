import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  deleteEnvVar,
  getAuxiliaryModels,
  getEnvVars,
  getGlobalModelInfo,
  getGlobalModelOptions,
  setEnvVar,
  setModelAssignment
} from '@/hermes'
import type { AuxiliaryModelsResponse, ModelOptionProvider } from '@/hermes'
import { Cpu, Loader2, Settings2, Sparkles, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { CONTROL_TEXT } from './constants'
import { ListRow, LoadingState, Pill, SectionHeading } from './primitives'

// Mirrors `_AUX_TASK_SLOTS` in hermes_cli/web_server.py. Friendly labels and
// hints make the assignments readable; raw task keys (vision, mcp, …) are
// opaque to most users.
interface AuxTaskMeta {
  hint: string
  key: string
  label: string
}

const AUX_TASKS: readonly AuxTaskMeta[] = [
  { key: 'vision', label: 'Vision', hint: 'Image analysis' },
  { key: 'web_extract', label: 'Web extract', hint: 'Page summarization' },
  { key: 'compression', label: 'Compression', hint: 'Context compaction' },
  { key: 'session_search', label: 'Session search', hint: 'Recall queries' },
  { key: 'skills_hub', label: 'Skills hub', hint: 'Skill search' },
  { key: 'approval', label: 'Approval', hint: 'Smart auto-approve' },
  { key: 'mcp', label: 'MCP', hint: 'MCP tool routing' },
  { key: 'title_generation', label: 'Title gen', hint: 'Session titles' },
  { key: 'curator', label: 'Curator', hint: 'Skill-usage review' }
]

const NO_PROVIDERS: readonly ModelOptionProvider[] = [{ name: '—', slug: '', models: [] }]

interface ProviderEnvFields {
  apiKeyEnv?: string
  baseUrlEnv?: string
}

const PROVIDER_ENV_FIELDS: Record<string, ProviderEnvFields> = {
  anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY' },
  copilot: { apiKeyEnv: 'GITHUB_TOKEN' },
  'openai-api': { apiKeyEnv: 'OPENAI_API_KEY', baseUrlEnv: 'OPENAI_BASE_URL' },
  lmstudio: { apiKeyEnv: 'LM_API_KEY', baseUrlEnv: 'LM_BASE_URL' },
  openrouter: { apiKeyEnv: 'OPENROUTER_API_KEY' },
  deepseek: { apiKeyEnv: 'DEEPSEEK_API_KEY', baseUrlEnv: 'DEEPSEEK_BASE_URL' },
  gemini: { apiKeyEnv: 'GEMINI_API_KEY', baseUrlEnv: 'GEMINI_BASE_URL' },
  nous: { apiKeyEnv: 'NOUS_API_KEY' },
  ollama: { apiKeyEnv: 'OLLAMA_API_KEY', baseUrlEnv: 'OLLAMA_BASE_URL' },
  custom: { apiKeyEnv: 'OPENAI_API_KEY', baseUrlEnv: 'OPENAI_BASE_URL' }
}

interface ModelSettingsProps {
  /** Notified after the main model is applied, so live UI stores can sync. */
  onMainModelChanged?: (provider: string, model: string) => void
}

export function ModelSettings({ onMainModelChanged }: ModelSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mainModel, setMainModel] = useState<{ model: string; provider: string } | null>(null)
  const [providers, setProviders] = useState<ModelOptionProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [auxiliary, setAuxiliary] = useState<AuxiliaryModelsResponse | null>(null)
  const [applying, setApplying] = useState(false)
  const [editingAuxTask, setEditingAuxTask] = useState<null | string>(null)
  const [auxDraft, setAuxDraft] = useState<{ model: string; provider: string }>({ model: '', provider: '' })
  const [providerManagerOpen, setProviderManagerOpen] = useState(false)
  const [providerManagerProvider, setProviderManagerProvider] = useState('')
  const [providerManagerApiKey, setProviderManagerApiKey] = useState('')
  const [providerManagerBaseUrl, setProviderManagerBaseUrl] = useState('')
  const [providerManagerSaving, setProviderManagerSaving] = useState(false)
  const [envVars, setEnvVars] = useState<Record<string, { is_set: boolean; redacted_value: null | string }> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [modelInfo, modelOptions, auxiliaryModels] = await Promise.all([
        getGlobalModelInfo(),
        getGlobalModelOptions(),
        getAuxiliaryModels()
      ])

      setMainModel({ model: modelInfo.model, provider: modelInfo.provider })
      setProviders(modelOptions.providers || [])
      setSelectedProvider(prev => prev || modelInfo.provider)
      setSelectedModel(prev => prev || modelInfo.model)
      setAuxiliary(auxiliaryModels)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!providerManagerOpen) {
      return
    }

    // Resolve the default provider slug, ensuring LM Studio is always an option
    const resolvedSlug =
      selectedProvider || mainModel?.provider || providers[0]?.slug || 'lmstudio'

    // Ensure LM Studio exists in the provider list so the dropdown default works
    const hasLmStudio = providers.some(p => p.slug === 'lmstudio')
    if (!hasLmStudio) {
      setProviders(prev => {
        if (prev.some(p => p.slug === 'lmstudio')) return prev
        return [...prev, { slug: 'lmstudio', name: 'LM Studio', models: [] }]
      })
    }

    setProviderManagerProvider(resolvedSlug)
    setProviderManagerApiKey('')
    setProviderManagerBaseUrl('')
    setError('')

    void (async () => {
      try {
        const next = await getEnvVars()
        setEnvVars(next)

        // Pre-fill awareness — we don't reveal values, but the Set/Not set
        // labels update from envVars state.
      } catch {
        // Best-effort loading; dialog still works for writes.
      }
    })()
  }, [providerManagerOpen, selectedProvider, mainModel?.provider, providers])

  const providerOptions = providers.length ? providers : NO_PROVIDERS

  const selectedProviderModels = useMemo(
    () => providers.find(provider => provider.slug === selectedProvider)?.models ?? [],
    [providers, selectedProvider]
  )

  const managerFields = useMemo(
    () => PROVIDER_ENV_FIELDS[providerManagerProvider] ?? {},
    [providerManagerProvider]
  )

  const managerProviderName =
    providerOptions.find(provider => provider.slug === providerManagerProvider)?.name || providerManagerProvider || 'Provider'

  const managerApiKeyStatus = managerFields.apiKeyEnv && envVars?.[managerFields.apiKeyEnv]?.is_set
  const managerBaseUrlStatus = managerFields.baseUrlEnv && envVars?.[managerFields.baseUrlEnv]?.is_set

  const auxDraftProviderModels = useMemo(
    () => providers.find(provider => provider.slug === auxDraft.provider)?.models ?? [],
    [auxDraft.provider, providers]
  )

  const applyMainModel = useCallback(async () => {
    if (!selectedProvider || !selectedModel) {
      return
    }

    setApplying(true)
    setError('')

    try {
      const result = await setModelAssignment({ model: selectedModel, provider: selectedProvider, scope: 'main' })
      const provider = result.provider || selectedProvider
      const model = result.model || selectedModel
      setMainModel({ provider, model })
      onMainModelChanged?.(provider, model)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }, [onMainModelChanged, refresh, selectedModel, selectedProvider])

  const setAuxiliaryToMain = useCallback(
    async (task: string) => {
      if (!mainModel) {
        return
      }

      setApplying(true)
      setError('')

      try {
        await setModelAssignment({ model: mainModel.model, provider: mainModel.provider, scope: 'auxiliary', task })
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setApplying(false)
      }
    },
    [mainModel, refresh]
  )

  const applyAuxiliaryDraft = useCallback(
    async (task: string) => {
      if (!auxDraft.provider || !auxDraft.model) {
        return
      }

      setApplying(true)
      setError('')

      try {
        await setModelAssignment({ model: auxDraft.model, provider: auxDraft.provider, scope: 'auxiliary', task })
        setEditingAuxTask(null)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setApplying(false)
      }
    },
    [auxDraft, refresh]
  )

  const beginAuxiliaryEdit = useCallback(
    (task: string) => {
      const current = auxiliary?.tasks.find(entry => entry.task === task)

      const initialProvider =
        current?.provider && current.provider !== 'auto' ? current.provider : (mainModel?.provider ?? '')

      const initialModel = current?.model || mainModel?.model || ''
      setAuxDraft({ provider: initialProvider, model: initialModel })
      setEditingAuxTask(task)
    },
    [auxiliary, mainModel]
  )

  const resetAuxiliaryModels = useCallback(async () => {
    if (!mainModel) {
      return
    }

    setApplying(true)
    setError('')

    try {
      await setModelAssignment({
        model: mainModel.model,
        provider: mainModel.provider,
        scope: 'auxiliary',
        task: '__reset__'
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }, [mainModel, refresh])

  const saveProviderManager = useCallback(async () => {
    if (!providerManagerProvider) {
      setError('No provider selected.')
      return
    }

    setProviderManagerSaving(true)
    setError('')

    try {
      const apiKey = providerManagerApiKey.trim()
      const baseUrl = providerManagerBaseUrl.trim()

      // For LM Studio / Ollama (local providers), base URL alone is sufficient.
      // For cloud providers, at least one of API key or base URL is required.
      const isLocalProvider = providerManagerProvider === 'lmstudio' || providerManagerProvider === 'ollama'
      const hasApiKeyField = !!managerFields.apiKeyEnv
      const hasBaseUrlField = !!managerFields.baseUrlEnv

      if (isLocalProvider && hasBaseUrlField && !apiKey && !baseUrl) {
        setError('Enter a base URL for the local provider.')
        setProviderManagerSaving(false)
        return
      }

      if (!isLocalProvider && !apiKey && !baseUrl) {
        setError('Enter at least an API key or a base URL.')
        setProviderManagerSaving(false)
        return
      }

      if (managerFields.apiKeyEnv && apiKey) {
        await setEnvVar(managerFields.apiKeyEnv, apiKey)
      }
      if (managerFields.baseUrlEnv && baseUrl) {
        await setEnvVar(managerFields.baseUrlEnv, baseUrl)
      }

      // Clear only the input fields after save (API key for security, baseUrl to keep UI clean)
      setProviderManagerApiKey('')
      setProviderManagerBaseUrl('')

      // Re-fetch env vars to update Set/Not set labels
      const next = await getEnvVars()
      setEnvVars(next)

      // Refresh the main provider list so the dialog reflects saved state
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProviderManagerSaving(false)
    }
  }, [managerFields.apiKeyEnv, managerFields.baseUrlEnv, providerManagerApiKey, providerManagerBaseUrl, providerManagerProvider, refresh])

  const clearProviderManagerField = useCallback(
    async (key: string) => {
      setProviderManagerSaving(true)
      setError('')
      try {
        await deleteEnvVar(key)
        const next = await getEnvVars()
        setEnvVars(next)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setProviderManagerSaving(false)
      }
    },
    [refresh]
  )

  if (loading && !mainModel) {
    return <LoadingState label="Loading model configuration..." />
  }

  return (
    <div className="grid gap-6">
      <section>
        <SectionHeading
          icon={Sparkles}
          meta={mainModel ? `${mainModel.provider} / ${mainModel.model}` : undefined}
          title="Main model"
        />
        <p className="mb-3 text-xs text-muted-foreground">
          Applies to new sessions. Use the model picker in the composer to hot-swap the active chat.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={setSelectedProvider} value={selectedProvider}>
            <SelectTrigger className={cn('min-w-40', CONTROL_TEXT)}>
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map(provider => (
                <SelectItem key={provider.slug || 'none'} value={provider.slug || 'none'}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSelectedModel} value={selectedModel}>
            <SelectTrigger className={cn('min-w-60', CONTROL_TEXT)}>
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {(selectedProviderModels.length ? selectedProviderModels : []).map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setProviderManagerOpen(true)} size="sm" variant="outline">
            <Settings2 className="size-3.5" />
            Manage provider
          </Button>
          <Button disabled={!selectedProvider || !selectedModel || applying} onClick={() => void applyMainModel()} size="sm">
            {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {applying ? 'Applying...' : 'Apply'}
          </Button>
        </div>
        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      </section>

      <Dialog onOpenChange={setProviderManagerOpen} open={providerManagerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage provider</DialogTitle>
            <DialogDescription>Configure API key and endpoint for the selected provider.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <Select onValueChange={setProviderManagerProvider} value={providerManagerProvider}>
                <SelectTrigger className={cn('min-w-44', CONTROL_TEXT)}>
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map(provider => (
                    <SelectItem key={provider.slug || 'none'} value={provider.slug || 'none'}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!managerFields.apiKeyEnv && !managerFields.baseUrlEnv && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                No direct key/endpoint fields are mapped for {managerProviderName} yet.
              </div>
            )}

            {managerFields.apiKeyEnv && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted-foreground">{managerFields.apiKeyEnv}</label>
                  <span className="text-[0.68rem] text-muted-foreground">
                    {managerApiKeyStatus ? 'Set' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className={cn('font-mono', CONTROL_TEXT)}
                    onChange={event => setProviderManagerApiKey(event.target.value)}
                    placeholder="Enter API key"
                    type="password"
                    value={providerManagerApiKey}
                  />
                  <Button
                    disabled={!managerApiKeyStatus || providerManagerSaving}
                    onClick={() => void clearProviderManagerField(managerFields.apiKeyEnv!)}
                    size="icon-sm"
                    title="Clear API key"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {managerFields.baseUrlEnv && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted-foreground">{managerFields.baseUrlEnv}</label>
                  <span className="text-[0.68rem] text-muted-foreground">
                    {managerBaseUrlStatus ? 'Set' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className={cn('font-mono', CONTROL_TEXT)}
                    onChange={event => setProviderManagerBaseUrl(event.target.value)}
                    placeholder="http://127.0.0.1:1234/v1"
                    type="text"
                    value={providerManagerBaseUrl}
                  />
                  <Button
                    disabled={!managerBaseUrlStatus || providerManagerSaving}
                    onClick={() => void clearProviderManagerField(managerFields.baseUrlEnv!)}
                    size="icon-sm"
                    title="Clear endpoint"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button onClick={() => setProviderManagerOpen(false)} size="sm" variant="outline">
                Close
              </Button>
              <Button
                disabled={
                  providerManagerSaving ||
                  (!providerManagerApiKey.trim() && !providerManagerBaseUrl.trim()) ||
                  !providerManagerProvider
                }
                onClick={() => void saveProviderManager()}
                size="sm"
              >
                {providerManagerSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Settings2 className="size-3.5" />}
                {providerManagerSaving ? 'Saving...' : 'Save provider settings'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionHeading icon={Cpu} title="Auxiliary models" />
          <Button
            disabled={!mainModel || applying}
            onClick={() => void resetAuxiliaryModels()}
            size="sm"
            variant="outline"
          >
            Reset all to main
          </Button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Helper tasks run on the main model by default. Assign a dedicated model to any task to override.
        </p>
        <div className="divide-y divide-border/40">
          {AUX_TASKS.map(meta => {
            const current = auxiliary?.tasks.find(entry => entry.task === meta.key)
            const isAuto = !current || !current.provider || current.provider === 'auto'
            const isEditing = editingAuxTask === meta.key

            return (
              <ListRow
                action={
                  !isEditing && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        disabled={!mainModel || applying}
                        onClick={() => void setAuxiliaryToMain(meta.key)}
                        size="sm"
                        variant="ghost"
                      >
                        Set to main
                      </Button>
                      <Button
                        disabled={!providers.length || applying}
                        onClick={() => beginAuxiliaryEdit(meta.key)}
                        size="sm"
                        variant="outline"
                      >
                        Change
                      </Button>
                    </div>
                  )
                }
                below={
                  isEditing && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                      <Select
                        onValueChange={value => setAuxDraft(prev => ({ ...prev, provider: value, model: '' }))}
                        value={auxDraft.provider}
                      >
                        <SelectTrigger className={cn('min-w-32', CONTROL_TEXT)}>
                          <SelectValue placeholder="Provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {providerOptions.map(provider => (
                            <SelectItem key={provider.slug || 'none'} value={provider.slug || 'none'}>
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={value => setAuxDraft(prev => ({ ...prev, model: value }))}
                        value={auxDraft.model}
                      >
                        <SelectTrigger className={cn('min-w-48', CONTROL_TEXT)}>
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {(auxDraftProviderModels.length ? auxDraftProviderModels : []).map(model => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!auxDraft.provider || !auxDraft.model || applying}
                        onClick={() => void applyAuxiliaryDraft(meta.key)}
                        size="sm"
                      >
                        {applying ? 'Applying...' : 'Apply'}
                      </Button>
                      <Button onClick={() => setEditingAuxTask(null)} size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  )
                }
                description={
                  <span className="font-mono text-[0.68rem]">
                    {isAuto ? 'auto · use main model' : `${current.provider} · ${current.model || '(provider default)'}`}
                  </span>
                }
                key={meta.key}
                title={
                  <span className="flex items-baseline gap-2">
                    {meta.label}
                    <Pill>{meta.hint}</Pill>
                  </span>
                }
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
