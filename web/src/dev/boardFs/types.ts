export interface CreateFolderBody {
  parent?: unknown
  name?: unknown
  scope?: unknown
}

export interface RenameFolderBody {
  path?: unknown
  name?: unknown
  parent?: unknown
  scope?: unknown
}

export interface DeleteFolderBody {
  path?: unknown
  scope?: unknown
}
