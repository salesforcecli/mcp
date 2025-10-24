/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export interface NativeCapabilityConfig {
  description: string;
  title: string;
  toolId: string;
  typeDefinitionPath: string;
  groundingDescription: string;
  serviceName: string;
  isCore: boolean;
}

export const AppReviewConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC App Review Service, laying the foundation for understanding mobile app review and offering expert-level guidance for implementing the App Review feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile App Review LWC Native Capability',
  toolId: 'create_mobile_lwc_app_review',
  typeDefinitionPath: 'appReview/appReviewService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages app review facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the app review API of the mobile device, within the LWC.',
  serviceName: 'App Review',
  isCore: false,
};

const ArSpaceCaptureConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC AR Space Capture, laying the foundation for understanding mobile AR space capture and offering expert-level guidance for implementing the AR Space Capture feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile AR Space Capture LWC Native Capability',
  toolId: 'create_mobile_lwc_ar_space_capture',
  typeDefinitionPath: 'arSpaceCapture/arSpaceCapture.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages AR Space Capture facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the AR Space Capture API of the mobile device, within the LWC.',
  serviceName: 'AR Space Capture',
  isCore: false,
};

const BarcodeScannerConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Barcode Scanner, laying the foundation for understanding mobile barcode scanner and offering expert-level guidance for implementing the Barcode Scanner feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Barcode Scanner LWC Native Capability',
  toolId: 'create_mobile_lwc_barcode_scanner',
  typeDefinitionPath: 'barcodeScanner/barcodeScanner.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages barcode scanning facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the barcode scanning API of the mobile device, within the LWC.',
  serviceName: 'Barcode Scanner',
  isCore: true,
};

const BiometricsConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Biometrics Service, laying the foundation for understanding mobile biometrics and offering expert-level guidance for implementing the Biometrics feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Biometrics Service LWC Native Capability',
  toolId: 'create_mobile_lwc_biometrics',
  typeDefinitionPath: 'biometrics/biometricsService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages biometrics scanning facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the face recognition and the finger printing scanner of the mobile device to authorize the user, within the LWC.',
  serviceName: 'Biometrics',
  isCore: true,
};

const CalendarConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Calendar Service, laying the foundation for understanding mobile calendar and offering expert-level guidance for implementing the Calendar feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Calendar Service LWC Native Capability',
  toolId: 'create_mobile_lwc_calendar',
  typeDefinitionPath: 'calendar/calendarService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages calendar facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the calendar API of the mobile device, within the LWC.',
  serviceName: 'Calendar',
  isCore: false,
};

const ContactsConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Contacts Service, laying the foundation for understanding mobile contacts and offering expert-level guidance for implementing the Contacts feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Contacts Service LWC Native Capability',
  toolId: 'create_mobile_lwc_contacts',
  typeDefinitionPath: 'contacts/contactsService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages contacts facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the contacts API of the mobile device, within the LWC.',
  serviceName: 'Contacts',
  isCore: false,
};

const DocumentScannerConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Document Scanner, laying the foundation for understanding mobile document scanner and offering expert-level guidance for implementing the Document Scanner feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Document Scanner LWC Native Capability',
  toolId: 'create_mobile_lwc_document_scanner',
  typeDefinitionPath: 'documentScanner/documentScanner.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages document scanning facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the document scanner API of the mobile device, within the LWC.',
  serviceName: 'Document Scanner',
  isCore: false,
};

const GeofencingConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Geofencing Service, laying the foundation for understanding mobile geofencing and offering expert-level guidance for implementing the Geofencing feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Geofencing Service LWC Native Capability',
  toolId: 'create_mobile_lwc_geofencing',
  typeDefinitionPath: 'geofencing/geofencingService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages geofencing facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the geofencing API of the mobile device, within the LWC.',
  serviceName: 'Geofencing',
  isCore: false,
};

const LocationConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Location Service, laying the foundation for understanding mobile location and offering expert-level guidance for implementing the Location feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Location Services LWC Native Capability',
  toolId: 'create_mobile_lwc_location',
  typeDefinitionPath: 'location/locationService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages location facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the location API of the mobile device, within the LWC.',
  serviceName: 'Location',
  isCore: true,
};

const NfcConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC NFC Service, laying the foundation for understanding mobile NFC and offering expert-level guidance for implementing the NFC feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile NFC Service LWC Native Capability',
  toolId: 'create_mobile_lwc_nfc',
  typeDefinitionPath: 'nfc/nfcService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages NFC facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the NFC API of the mobile device, within the LWC.',
  serviceName: 'NFC',
  isCore: false,
};

const PaymentsConfig: NativeCapabilityConfig = {
  description:
    'The MCP tool provides a comprehensive TypeScript-based API documentation for Salesforce LWC Payments Service, laying the foundation for understanding mobile payments and offering expert-level guidance for implementing the Payments feature in a Lightning Web Component (LWC).',
  title: 'Salesforce Mobile Payments Service LWC Native Capability',
  toolId: 'create_mobile_lwc_payments',
  typeDefinitionPath: 'payments/paymentsService.d.ts',
  groundingDescription:
    'The following content provides grounding information for generating a Salesforce LWC that leverages payments facilities on mobile devices. Specifically, this context will cover the API types and methods available to leverage the payments API of the mobile device, within the LWC.',
  serviceName: 'Payments',
  isCore: false,
};

export const nativeCapabilityConfigs: NativeCapabilityConfig[] = [
  AppReviewConfig,
  ArSpaceCaptureConfig,
  BarcodeScannerConfig,
  BiometricsConfig,
  CalendarConfig,
  ContactsConfig,
  DocumentScannerConfig,
  GeofencingConfig,
  LocationConfig,
  NfcConfig,
  PaymentsConfig,
];
