{{/*
Expand the name of the chart.
*/}}
{{- define "presk-control-tower.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this
(by the DNS naming spec). If the release name already contains the chart name,
it is used as the full name.
*/}}
{{- define "presk-control-tower.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "presk-control-tower.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "presk-control-tower.labels" -}}
helm.sh/chart: {{ include "presk-control-tower.chart" . }}
{{ include "presk-control-tower.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "presk-control-tower.selectorLabels" -}}
app.kubernetes.io/name: {{ include "presk-control-tower.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "presk-control-tower.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "presk-control-tower.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Image tag. `image.tag` wins over `global.imageTag` so the chart can be
installed standalone as well as from the umbrella chart.
*/}}
{{- define "presk-control-tower.imageTag" -}}
{{- $tag := .Values.image.tag -}}
{{- if not $tag }}
{{- $global := index .Values "global" | default dict -}}
{{- $tag = index $global "imageTag" | default "" -}}
{{- end }}
{{- if not $tag }}
{{- fail "presk-control-tower.image.tag or global.imageTag must be set" -}}
{{- end }}
{{- $tag -}}
{{- end }}

{{/*
Fully qualified image reference.
*/}}
{{- define "presk-control-tower.image" -}}
{{- printf "%s:%s" .Values.image.repository (include "presk-control-tower.imageTag" .) -}}
{{- end }}

{{/*
Merged image pull secrets from the local chart values and the umbrella
chart's global values.
*/}}
{{- define "presk-control-tower.imagePullSecrets" -}}
{{- $globalValues := index .Values "global" | default dict -}}
{{- $global := index $globalValues "imagePullSecrets" | default (list) -}}
{{- $local := .Values.imagePullSecrets | default (list) -}}
{{- $merged := concat $global $local | uniq -}}
{{- $normalized := list -}}
{{- range $merged -}}
{{- if kindIs "string" . -}}
{{- $normalized = append $normalized (dict "name" .) -}}
{{- else -}}
{{- $normalized = append $normalized . -}}
{{- end -}}
{{- end -}}
{{- if $normalized }}
{{- toYaml $normalized -}}
{{- end }}
{{- end }}
