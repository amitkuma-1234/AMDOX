{{/*
AMDOX ERP Helm Chart — Template Helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "amdox.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "amdox.fullname" -}}
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
{{- define "amdox.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "amdox.labels" -}}
helm.sh/chart: {{ include "amdox.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: amdox-erp
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Selector labels for a specific component
*/}}
{{- define "amdox.selectorLabels" -}}
app.kubernetes.io/name: {{ include "amdox.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Component-specific labels
*/}}
{{- define "amdox.componentLabels" -}}
{{ include "amdox.labels" . }}
{{ include "amdox.selectorLabels" . }}
{{- end }}

{{/*
Service Account name
*/}}
{{- define "amdox.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "amdox.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Namespace
*/}}
{{- define "amdox.namespace" -}}
{{- default .Release.Namespace .Values.namespace }}
{{- end }}

{{/*
Image reference helper
*/}}
{{- define "amdox.image" -}}
{{- $registry := .global.imageRegistry | default "" -}}
{{- $repository := .image.repository -}}
{{- $tag := .image.tag | default "latest" -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}
{{- end }}
