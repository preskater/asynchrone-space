import type { RequestContext } from "@/lib/core/context"
import type { Page, PageInput } from "@/lib/core/pagination"
import type {
  ActivityInput,
  ClientInput,
  CloseDealInput,
  ContactInput,
  DealInput,
  ExportInput,
  FieldDefinitionInput,
  ImportClientsInput,
  ImportContactsInput,
  LinkDocumentInput,
  LinkProjectInput,
  MoveDealInput,
  MoveStageInput,
  PipelineInput,
  StageInput,
  UnlinkProjectInput,
  UpdateDocumentVisibilityInput,
} from "./schemas"
import type {
  CrmActivityData,
  CrmClientData,
  CrmClientDetailData,
  CrmContactData,
  CrmContactDetailData,
  CrmDealData,
  CrmDealDetailData,
  CrmDocumentData,
  CrmExportResultData,
  CrmFieldDefinitionData,
  CrmFieldEntity,
  CrmFileOptionData,
  CrmImportResultData,
  CrmOverviewData,
  CrmPipelineData,
  CrmProjectLinkOptionData,
  CrmProjectOptionData,
} from "./types"

import type { CrmRepository } from "./repository"
import { CrmOverviewService } from "./services/overview"
import { CrmClientsService } from "./services/clients"
import { CrmContactsService } from "./services/contacts"
import { CrmDealsService } from "./services/deals"
import { CrmPipelinesService } from "./services/pipelines"
import { CrmFieldsService } from "./services/fields"
import { CrmDocumentsService } from "./services/documents"
import { CrmLinksService } from "./services/links"
import { CrmActivitiesService } from "./services/activities"
import { CrmImportExportService } from "./services/import-export"

/**
 * CRM facade. Each method delegates to the sub-domain service in
 * `./services`, which keeps the public API stable while the
 * implementation stays split by subdomain.
 */
export class CrmService {
  private readonly overview: CrmOverviewService
  private readonly clients: CrmClientsService
  private readonly contacts: CrmContactsService
  private readonly deals: CrmDealsService
  private readonly pipelines: CrmPipelinesService
  private readonly fields: CrmFieldsService
  private readonly documents: CrmDocumentsService
  private readonly links: CrmLinksService
  private readonly activities: CrmActivitiesService
  private readonly importExport: CrmImportExportService

  constructor(repo: CrmRepository) {
    this.overview = new CrmOverviewService(repo)
    this.clients = new CrmClientsService(repo)
    this.contacts = new CrmContactsService(repo)
    this.deals = new CrmDealsService(repo)
    this.pipelines = new CrmPipelinesService(repo)
    this.fields = new CrmFieldsService(repo)
    this.documents = new CrmDocumentsService(repo)
    this.links = new CrmLinksService(repo)
    this.activities = new CrmActivitiesService(repo)
    this.importExport = new CrmImportExportService(repo)
  }

  async getOverview(ctx: RequestContext): Promise<CrmOverviewData> {
    return this.overview.getOverview(ctx)
  }

  async getClientDetail(
    ctx: RequestContext,
    clientId: string
  ): Promise<CrmClientDetailData> {
    return this.overview.getClientDetail(ctx, clientId)
  }

  async getContactDetail(
    ctx: RequestContext,
    contactId: string
  ): Promise<CrmContactDetailData> {
    return this.overview.getContactDetail(ctx, contactId)
  }

  async getDealDetail(
    ctx: RequestContext,
    dealId: string
  ): Promise<CrmDealDetailData> {
    return this.overview.getDealDetail(ctx, dealId)
  }

  async listClientsPage(
    ctx: RequestContext,
    input: PageInput = {}
  ): Promise<Page<CrmClientData>> {
    return this.clients.listClientsPage(ctx, input)
  }

  async listContactsPage(
    ctx: RequestContext,
    input: PageInput = {}
  ): Promise<Page<CrmContactData>> {
    return this.contacts.listContactsPage(ctx, input)
  }

  async listDealsPage(
    ctx: RequestContext,
    input: PageInput = {}
  ): Promise<Page<CrmDealData>> {
    return this.deals.listDealsPage(ctx, input)
  }

  async listActivitiesPage(
    ctx: RequestContext,
    input: PageInput & {
      clientId?: string
      contactId?: string
      dealId?: string
    } = {}
  ): Promise<Page<CrmActivityData>> {
    return this.activities.listActivitiesPage(ctx, input)
  }

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<CrmClientData> {
    return this.clients.saveClient(ctx, input)
  }

  async archiveClient(ctx: RequestContext, id: string): Promise<CrmClientData> {
    return this.clients.archiveClient(ctx, id)
  }

  async restoreClient(ctx: RequestContext, id: string): Promise<CrmClientData> {
    return this.clients.restoreClient(ctx, id)
  }

  async saveContact(
    ctx: RequestContext,
    input: ContactInput
  ): Promise<CrmContactData> {
    return this.contacts.saveContact(ctx, input)
  }

  async archiveContact(
    ctx: RequestContext,
    id: string
  ): Promise<CrmContactData> {
    return this.contacts.archiveContact(ctx, id)
  }

  async restoreContact(
    ctx: RequestContext,
    id: string
  ): Promise<CrmContactData> {
    return this.contacts.restoreContact(ctx, id)
  }

  async saveDeal(ctx: RequestContext, input: DealInput): Promise<CrmDealData> {
    return this.deals.saveDeal(ctx, input)
  }

  async moveDeal(
    ctx: RequestContext,
    input: MoveDealInput
  ): Promise<CrmDealData> {
    return this.deals.moveDeal(ctx, input)
  }

  async closeDeal(
    ctx: RequestContext,
    input: CloseDealInput
  ): Promise<CrmDealData> {
    return this.deals.closeDeal(ctx, input)
  }

  async reopenDeal(ctx: RequestContext, dealId: string): Promise<CrmDealData> {
    return this.deals.reopenDeal(ctx, dealId)
  }

  async archiveDeal(ctx: RequestContext, id: string): Promise<CrmDealData> {
    return this.deals.archiveDeal(ctx, id)
  }

  async restoreDeal(ctx: RequestContext, id: string): Promise<CrmDealData> {
    return this.deals.restoreDeal(ctx, id)
  }

  async savePipeline(
    ctx: RequestContext,
    input: PipelineInput
  ): Promise<CrmPipelineData> {
    return this.pipelines.savePipeline(ctx, input)
  }

  async setDefaultPipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<CrmPipelineData> {
    return this.pipelines.setDefaultPipeline(ctx, pipelineId)
  }

  async deletePipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<{ id: string }> {
    return this.pipelines.deletePipeline(ctx, pipelineId)
  }

  async saveStage(
    ctx: RequestContext,
    input: StageInput
  ): Promise<CrmPipelineData> {
    return this.pipelines.saveStage(ctx, input)
  }

  async moveStage(
    ctx: RequestContext,
    input: MoveStageInput
  ): Promise<CrmPipelineData> {
    return this.pipelines.moveStage(ctx, input)
  }

  async deleteStage(
    ctx: RequestContext,
    stageId: string
  ): Promise<CrmPipelineData> {
    return this.pipelines.deleteStage(ctx, stageId)
  }

  async saveFieldDefinition(
    ctx: RequestContext,
    input: FieldDefinitionInput
  ): Promise<CrmFieldDefinitionData> {
    return this.fields.saveFieldDefinition(ctx, input)
  }

  async deleteFieldDefinition(
    ctx: RequestContext,
    id: string
  ): Promise<{ id: string }> {
    return this.fields.deleteFieldDefinition(ctx, id)
  }

  async listDocuments(
    ctx: RequestContext,
    entity: CrmFieldEntity,
    entityId: string
  ): Promise<CrmDocumentData[]> {
    return this.documents.listDocuments(ctx, entity, entityId)
  }

  async linkDocument(
    ctx: RequestContext,
    input: LinkDocumentInput
  ): Promise<CrmDocumentData> {
    return this.documents.linkDocument(ctx, input)
  }

  async unlinkDocument(
    ctx: RequestContext,
    id: string
  ): Promise<{ id: string }> {
    return this.documents.unlinkDocument(ctx, id)
  }

  async updateDocumentVisibility(
    ctx: RequestContext,
    input: UpdateDocumentVisibilityInput
  ): Promise<CrmDocumentData> {
    return this.documents.updateDocumentVisibility(ctx, input)
  }

  async fetchFileOptions(ctx: RequestContext): Promise<CrmFileOptionData[]> {
    return this.documents.fetchFileOptions(ctx)
  }

  async fetchProjectOptions(
    ctx: RequestContext
  ): Promise<CrmProjectLinkOptionData[]> {
    return this.links.fetchProjectOptions(ctx)
  }

  async linkProject(
    ctx: RequestContext,
    input: LinkProjectInput
  ): Promise<CrmProjectOptionData> {
    return this.links.linkProject(ctx, input)
  }

  async unlinkProject(
    ctx: RequestContext,
    input: UnlinkProjectInput
  ): Promise<{ id: string }> {
    return this.links.unlinkProject(ctx, input)
  }

  async createActivity(
    ctx: RequestContext,
    input: ActivityInput
  ): Promise<CrmActivityData> {
    return this.activities.createActivity(ctx, input)
  }

  async exportCrm(
    ctx: RequestContext,
    input: ExportInput
  ): Promise<CrmExportResultData> {
    return this.importExport.exportCrm(ctx, input)
  }

  async importClients(
    ctx: RequestContext,
    input: ImportClientsInput
  ): Promise<CrmImportResultData> {
    return this.importExport.importClients(ctx, input)
  }

  async importContacts(
    ctx: RequestContext,
    input: ImportContactsInput
  ): Promise<CrmImportResultData> {
    return this.importExport.importContacts(ctx, input)
  }
}
