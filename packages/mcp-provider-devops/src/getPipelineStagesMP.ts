import { getConnection } from "./shared/auth.js";

export interface PipelineStageRecordMP {
    Id: string;
    Name: string;
    PipelineId: string;
    BranchId?: string;
    BranchName?: string;
    NextStageId?: string;
    NextStageName?: string;
    NextStageBranchName?: string;
}

/**
 * Fetch Pipeline Stages for a Managed Package pipeline (sf_devops__Pipeline_Stage__c).
 * Includes current stage's branch and the next stage's name/branch.
 */
export async function fetchPipelineStagesMP(username: string, pipelineId: string): Promise<PipelineStageRecordMP[] | any> {
    try {
        const connection = await getConnection(username);
        const query = `
            SELECT
                Id,
                Name,
                sf_devops__Pipeline__c,
                sf_devops__Branch__c,
                sf_devops__Branch__r.sf_devops__Name__c,
                sf_devops__Branch__r.sf_devops__Repository__r.sf_devops__Url__c,
                sf_devops__Next_Stage__c,
                sf_devops__Next_Stage__r.Name
            FROM sf_devops__Pipeline_Stage__c
            WHERE sf_devops__Pipeline__c = '${pipelineId}'
        `;
        const result: any = await connection.query(query);
        const records: any[] = result?.records || [];
        return records.map((r: any): PipelineStageRecordMP => ({
            Id: r.Id,
            Name: r.Name,
            PipelineId: r.sf_devops__Pipeline__c,
            BranchId: r.sf_devops__Branch__c,
            BranchName: r?.sf_devops__Branch__r?.sf_devops__Name__c,
            NextStageId: r?.sf_devops__Next_Stage__c,
            NextStageName: r?.sf_devops__Next_Stage__r?.Name
        }));
    } catch (error) {
        return error;
    }
}


