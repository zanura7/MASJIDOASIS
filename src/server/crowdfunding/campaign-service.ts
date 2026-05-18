export class CampaignServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "CampaignServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export interface CampaignRecord {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  description: string;
  targetCents: bigint;
  raisedCents: bigint;
  currency: string;
  status: CampaignStatus;
  coverImage?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  owner?: { name: string };
  [key: string]: unknown;
}

export interface CreateCampaignInput {
  ownerId: string;
  title: string;
  description: string;
  targetCents: bigint;
  coverImage?: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  targetCents?: bigint;
  coverImage?: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface CampaignStore {
  create(input: {
    ownerId: string;
    slug: string;
    title: string;
    description: string;
    targetCents: bigint;
    raisedCents: bigint;
    currency: string;
    status: CampaignStatus;
    coverImage?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<CampaignRecord>;

  update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      targetCents: bigint;
      coverImage: string | null;
      startsAt: Date | null;
      endsAt: Date | null;
      status: CampaignStatus;
    }>
  ): Promise<CampaignRecord>;

  delete(id: string): Promise<void>;

  findById(id: string): Promise<CampaignRecord | null>;

  findBySlug(slug: string): Promise<CampaignRecord | null>;

  listActive(): Promise<CampaignRecord[]>;

  listAll(): Promise<CampaignRecord[]>;

  countBySlug(slug: string): Promise<number>;

  incrementRaised(id: string, amountCents: bigint): Promise<void>;
}

export class CampaignService {
  private store: CampaignStore;

  constructor({ store }: { store: CampaignStore }) {
    this.store = store;
  }

  async createCampaign(input: CreateCampaignInput): Promise<CampaignRecord> {
    // Validation
    if (!input.title || input.title.trim().length === 0) {
      throw new CampaignServiceError(
        "INVALID_TITLE",
        400,
        "Title cannot be empty"
      );
    }

    if (input.targetCents <= BigInt(0)) {
      throw new CampaignServiceError(
        "INVALID_TARGET",
        400,
        "Target must be greater than zero"
      );
    }

    // Generate unique slug
    const baseSlug = this.slugify(input.title);
    const slug = await this.generateUniqueSlug(baseSlug);

    return this.store.create({
      ownerId: input.ownerId,
      slug,
      title: input.title,
      description: input.description,
      targetCents: input.targetCents,
      raisedCents: BigInt(0),
      currency: "IDR",
      status: "DRAFT",
      coverImage: input.coverImage || null,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
    });
  }

  async updateCampaign(
    id: string,
    input: UpdateCampaignInput
  ): Promise<CampaignRecord> {
    const campaign = await this.store.findById(id);

    if (!campaign) {
      throw new CampaignServiceError(
        "CAMPAIGN_NOT_FOUND",
        404,
        "Campaign not found"
      );
    }

    if (campaign.status === "CLOSED") {
      throw new CampaignServiceError(
        "CAMPAIGN_CLOSED",
        400,
        "Cannot update closed campaign"
      );
    }

    return this.store.update(id, input);
  }

  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.store.findById(id);

    if (!campaign) {
      throw new CampaignServiceError(
        "CAMPAIGN_NOT_FOUND",
        404,
        "Campaign not found"
      );
    }

    if (campaign.raisedCents > BigInt(0)) {
      throw new CampaignServiceError(
        "CAMPAIGN_HAS_FUNDS",
        400,
        "Cannot delete campaign with raised funds"
      );
    }

    await this.store.delete(id);
  }

  async publishCampaign(id: string): Promise<CampaignRecord> {
    const campaign = await this.store.findById(id);

    if (!campaign) {
      throw new CampaignServiceError(
        "CAMPAIGN_NOT_FOUND",
        404,
        "Campaign not found"
      );
    }

    if (campaign.status === "ACTIVE") {
      throw new CampaignServiceError(
        "CAMPAIGN_ALREADY_ACTIVE",
        400,
        "Campaign is already active"
      );
    }

    return this.store.update(id, { status: "ACTIVE" });
  }

  async closeCampaign(id: string): Promise<CampaignRecord> {
    const campaign = await this.store.findById(id);

    if (!campaign) {
      throw new CampaignServiceError(
        "CAMPAIGN_NOT_FOUND",
        404,
        "Campaign not found"
      );
    }

    if (campaign.status === "CLOSED") {
      throw new CampaignServiceError(
        "CAMPAIGN_ALREADY_CLOSED",
        400,
        "Campaign is already closed"
      );
    }

    return this.store.update(id, { status: "CLOSED" });
  }

  async listActiveCampaigns(): Promise<CampaignRecord[]> {
    return this.store.listActive();
  }

  async getCampaignBySlug(slug: string): Promise<CampaignRecord | null> {
    return this.store.findBySlug(slug);
  }

  async getCampaignById(id: string): Promise<CampaignRecord | null> {
    return this.store.findById(id);
  }

  async incrementRaised(id: string, amountCents: bigint): Promise<void> {
    return this.store.incrementRaised(id, amountCents);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while ((await this.store.countBySlug(slug)) > 0) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
