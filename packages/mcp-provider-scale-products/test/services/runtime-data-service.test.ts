import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RuntimeDataService,
  RuntimeDataStatus,
} from "../../src/services/runtime-data-service.js";
import type { RuntimeReport, RuntimeDataRequest, ClassRuntimeData } from "../../src/models/runtime-data.js";

describe("RuntimeDataService", () => {
  describe("constructor", () => {
    it("should use default timeout and retryAttempts", () => {
      const service = new RuntimeDataService({ apiPath: "/api" });
      expect(service).toBeDefined();
    });

    it("should accept custom timeout and retryAttempts", () => {
      const service = new RuntimeDataService({
        apiPath: "/api",
        timeoutMs: 5000,
        retryAttempts: 3,
      });
      expect(service).toBeDefined();
    });
  });

  describe("getClassData", () => {
    it("should return class data when present", () => {
      const classData: ClassRuntimeData = {
        methods: [],
        soqlRuntimeData: [],
      };
      const report: RuntimeReport = {
        status: "SUCCESS",
        message: "OK",
        classData: { MyClass: classData },
      };
      expect(RuntimeDataService.getClassData(report, "MyClass")).toBe(classData);
    });

    it("should return undefined when class not in report", () => {
      const report: RuntimeReport = {
        status: "SUCCESS",
        message: "OK",
        classData: {},
      };
      expect(RuntimeDataService.getClassData(report, "OtherClass")).toBeUndefined();
    });
  });

  describe("generateRequestId", () => {
    it("should return id containing orgId and userId", () => {
      const id = RuntimeDataService.generateRequestId("org1", "user1");
      expect(id).toContain("org1");
      expect(id).toContain("user1");
      expect(id).toMatch(/^org1:user1:\d+$/);
    });
  });

  describe("fetchRuntimeData", () => {
    it("should return SUCCESS when API returns success", async () => {
      const classData: ClassRuntimeData = { methods: [], soqlRuntimeData: [] };
      const report: RuntimeReport = {
        status: "SUCCESS",
        message: "OK",
        classData: { MyClass: classData },
      };
      const connection = {
        request: vi.fn().mockResolvedValue(report),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api" });
      const request: RuntimeDataRequest = {
        requestId: "req-1",
        orgId: "org1",
        classes: ["MyClass"],
      };

      const result = await service.fetchRuntimeData(connection, request);

      expect(result.status).toBe(RuntimeDataStatus.SUCCESS);
      expect(result.report).toEqual(report);
      expect(connection.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/api",
          body: JSON.stringify(request),
        })
      );
    });

    it("should return ACCESS_DENIED when message contains access denied", async () => {
      const connection = {
        request: vi.fn().mockResolvedValue({
          status: "FAILURE",
          message: "Access denied to ApexGuru",
        }),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api" });
      const request: RuntimeDataRequest = {
        requestId: "req-1",
        orgId: "org1",
        classes: ["MyClass"],
      };

      const result = await service.fetchRuntimeData(connection, request);

      expect(result.status).toBe(RuntimeDataStatus.ACCESS_DENIED);
      expect(result.report).toBeNull();
      expect(result.message).toContain("Access denied");
    });

    it("should return ACCESS_DENIED when message contains permission", async () => {
      const connection = {
        request: vi.fn().mockResolvedValue({
          status: "FAILURE",
          message: "Permission denied",
        }),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api" });
      const result = await service.fetchRuntimeData(connection, {
        requestId: "r",
        orgId: "o",
        classes: ["C"],
      });

      expect(result.status).toBe(RuntimeDataStatus.ACCESS_DENIED);
    });

    it("should return API_ERROR when API returns non-success and not access denied", async () => {
      const connection = {
        request: vi.fn().mockResolvedValue({
          status: "FAILURE",
          message: "Internal server error",
        }),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api" });
      const result = await service.fetchRuntimeData(connection, {
        requestId: "r",
        orgId: "o",
        classes: ["C"],
      });

      expect(result.status).toBe(RuntimeDataStatus.API_ERROR);
      expect(result.message).toBe("Internal server error");
    });

    it("should return API_ERROR after retries exhausted", async () => {
      const connection = {
        request: vi.fn().mockRejectedValue(new Error("Network error")),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api", retryAttempts: 1 });
      const result = await service.fetchRuntimeData(connection, {
        requestId: "r",
        orgId: "o",
        classes: ["C"],
      });

      expect(result.status).toBe(RuntimeDataStatus.API_ERROR);
      expect(result.message).toBe("Network error");
      expect(connection.request).toHaveBeenCalledTimes(2);
    });

    it("should return API_ERROR with message when retryAttempts is 0 and request throws", async () => {
      const connection = {
        request: vi.fn().mockRejectedValue(new Error("Connection refused")),
      } as any;

      const service = new RuntimeDataService({ apiPath: "/api", retryAttempts: 0 });
      const result = await service.fetchRuntimeData(connection, {
        requestId: "r",
        orgId: "o",
        classes: ["C"],
      });

      expect(result.status).toBe(RuntimeDataStatus.API_ERROR);
      expect(result.message).toBe("Connection refused");
      expect(connection.request).toHaveBeenCalledTimes(1);
    });
  });
});
