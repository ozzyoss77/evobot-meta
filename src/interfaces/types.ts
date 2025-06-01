import Logger from "src/Utils/logger";

export interface MediaTag {
  bucketName: string;
  sendFunction: (phone: string, delay: number, caption: string, url: string) => Promise<void>;
}

export interface Config {
  labelsName: string[];
  priorityName: string[];
  imagesTags: string[];
  videosTags: string[];
  documentsTags: string[];
  notifications: string;
  blockUserAutomatic: string;
  followUpActivate: string;
  separateUrl: string;
  lobbyActivate: string;
  sheetRegexActivate: string;
  calAppointmentActivated: string;
  shopifyActivate: string;
}

export interface IntegrationResponse {
  success: boolean;
  text: string;
  data?: any;
}

export abstract class BaseIntegrationService {
  protected logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  abstract processTag(text: string, state: Map<string, any>): Promise<IntegrationResponse>;
  abstract isEnabled(): boolean;
}