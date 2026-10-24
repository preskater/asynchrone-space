import type { RequestContext } from "@workspace/core"
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
  ClientActivityData,
  ClientSummaryData,
  ClientDetailData,
  ContactData,
  ContactDetailData,
  DealData,
  DealDetailData,
  ClientDocumentData,
  ClientsExportResultData,
  ClientFieldDefinitionData,
  ClientFieldEntity,
  FileOptionData,
  ClientsImportResultData,
  ClientsOverviewData,
  PipelineData,
  ProjectLinkOptionData,
  ProjectOptionData,
} from "./types"

import type { ClientsRepository } from "./repository"
import { ClientsOverviewService } from "./services/overview"
import { ClientRecordsService } from "./services/clients"
import { ContactsService } from "./services/contacts"
import { DealsService } from "./services/deals"
import { PipelinesService } from "./services/pipelines"
import { ClientFieldsService } from "./services/fields"
import { ClientDocumentsService } from "./services/documents"
import { ClientLinksService } from "./services/links"
import { ClientActivitiesService } from "./services/activities"
import { ClientsImportExportService } from "./services/import-export"

/**
 * Clients facade. Each method delegates to the sub-domain service in
 * `./services`, which keeps the public API stable while the
 * implementation stays split by subdomain.
 */
export class ClientsService {
  private readonly overview: ClientsOverviewService
  private readonly clients: ClientRecordsService
  private readonly contacts: ContactsService
  private readonly deals: DealsService
  private readonly pipelines: PipelinesService
  private readonly fields: ClientFieldsService
  private readonly documents: ClientDocumentsService
  private readonly links: ClientLinksService
  private readonly activities: ClientActivitiesService
  private readonly importExport: ClientsImportExportService

  constructor(repo: ClientsRepository) {
    this.overview = new ClientsOverviewService(repo)
    this.clients = new ClientRecordsService(repo)
    this.contacts = new ContactsService(repo)
    this.deals = new DealsService(repo)
    this.pipelines = new PipelinesService(repo)
    this.fields = new ClientFieldsService(repo)
    this.documents = new ClientDocumentsService(repo)
    this.links = new ClientLinksService(repo)
    this.activities = new ClientActivitiesService(repo)
    this.importExport = new ClientsImportExportService(repo)
  }

  async getOverview(ctx: RequestContext): Promise<ClientsOverviewData> {
    return this.overview.getOverview(ctx)
  }

  async getClientDetail(
    ctx: RequestContext,
    clientId: string
  ): Promise<ClientDetailData> {
    return this.overview.getClientDetail(ctx, clientId)
  }

  async getContactDetail(
    ctx: RequestContext,
    contactId: string
  ): Promise<ContactDetailData> {
    return this.overview.getContactDetail(ctx, contactId)
  }

  async getDealDetail(
    ctx: RequestContext,
    dealId: string
  ): Promise<DealDetailData> {
    return this.overview.getDealDetail(ctx, dealId)
  }

  async saveClient(
    ctx: RequestContext,
    input: ClientInput
  ): Promise<ClientSummaryData> {
    return this.clients.saveClient(ctx, input)
  }

  async archiveClient(ctx: RequestContext, id: string): Promise<ClientSummaryData> {
    return this.clients.archiveClient(ctx, id)
  }

  async restoreClient(ctx: RequestContext, id: string): Promise<ClientSummaryData> {
    return this.clients.restoreClient(ctx, id)
  }

  async saveContact(
    ctx: RequestContext,
    input: ContactInput
  ): Promise<ContactData> {
    return this.contacts.saveContact(ctx, input)
  }

  async archiveContact(
    ctx: RequestContext,
    id: string
  ): Promise<ContactData> {
    return this.contacts.archiveContact(ctx, id)
  }

  async restoreContact(
    ctx: RequestContext,
    id: string
  ): Promise<ContactData> {
    return this.contacts.restoreContact(ctx, id)
  }

  async saveDeal(ctx: RequestContext, input: DealInput): Promise<DealData> {
    return this.deals.saveDeal(ctx, input)
  }

  async moveDeal(
    ctx: RequestContext,
    input: MoveDealInput
  ): Promise<DealData> {
    return this.deals.moveDeal(ctx, input)
  }

  async closeDeal(
    ctx: RequestContext,
    input: CloseDealInput
  ): Promise<DealData> {
    return this.deals.closeDeal(ctx, input)
  }

  async reopenDeal(ctx: RequestContext, dealId: string): Promise<DealData> {
    return this.deals.reopenDeal(ctx, dealId)
  }

  async archiveDeal(ctx: RequestContext, id: string): Promise<DealData> {
    return this.deals.archiveDeal(ctx, id)
  }

  async restoreDeal(ctx: RequestContext, id: string): Promise<DealData> {
    return this.deals.restoreDeal(ctx, id)
  }

  async savePipeline(
    ctx: RequestContext,
    input: PipelineInput
  ): Promise<PipelineData> {
    return this.pipelines.savePipeline(ctx, input)
  }

  async setDefaultPipeline(
    ctx: RequestContext,
    pipelineId: string
  ): Promise<PipelineData> {
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
  ): Promise<PipelineData> {
    return this.pipelines.saveStage(ctx, input)
  }

  async moveStage(
    ctx: RequestContext,
    input: MoveStageInput
  ): Promise<PipelineData> {
    return this.pipelines.moveStage(ctx, input)
  }

  async deleteStage(
    ctx: RequestContext,
    stageId: string
  ): Promise<PipelineData> {
    return this.pipelines.deleteStage(ctx, stageId)
  }

  async saveFieldDefinition(
    ctx: RequestContext,
    input: FieldDefinitionInput
  ): Promise<ClientFieldDefinitionData> {
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
    entity: ClientFieldEntity,
    entityId: string
  ): Promise<ClientDocumentData[]> {
    return this.documents.listDocuments(ctx, entity, entityId)
  }

  async linkDocument(
    ctx: RequestContext,
    input: LinkDocumentInput
  ): Promise<ClientDocumentData> {
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
  ): Promise<ClientDocumentData> {
    return this.documents.updateDocumentVisibility(ctx, input)
  }

  async fetchFileOptions(ctx: RequestContext): Promise<FileOptionData[]> {
    return this.documents.fetchFileOptions(ctx)
  }

  async fetchProjectOptions(
    ctx: RequestContext
  ): Promise<ProjectLinkOptionData[]> {
    return this.links.fetchProjectOptions(ctx)
  }

  async linkProject(
    ctx: RequestContext,
    input: LinkProjectInput
  ): Promise<ProjectOptionData> {
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
  ): Promise<ClientActivityData> {
    return this.activities.createActivity(ctx, input)
  }

  async exportClients(
    ctx: RequestContext,
    input: ExportInput
  ): Promise<ClientsExportResultData> {
    return this.importExport.exportClients(ctx, input)
  }

  async importClients(
    ctx: RequestContext,
    input: ImportClientsInput
  ): Promise<ClientsImportResultData> {
    return this.importExport.importClients(ctx, input)
  }

  async importContacts(
    ctx: RequestContext,
    input: ImportContactsInput
  ): Promise<ClientsImportResultData> {
    return this.importExport.importContacts(ctx, input)
  }
}
