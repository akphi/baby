import { StatusCodes } from "http-status-codes";

export const HttpStatus = StatusCodes;
export const CHARSET = "charset=utf-8";

export enum HttpHeader {
  CONTENT_TYPE = "Content-Type",
  ACCEPT = "Accept",
}

export enum ContentType {
  APPLICATION_JSON = "application/json",
  APPLICATION_XML = "application/xml",
  APPLICATION_ZLIB = "application/zlib",
  TEXT_PLAIN = "text/plain",
  TEXT_CSV = "text/csv",
  ALL = "*/*",
}

export enum HttpMethod {
  GET = "get",
  PUT = "put",
  POST = "post",
  DELETE = "delete",
}
