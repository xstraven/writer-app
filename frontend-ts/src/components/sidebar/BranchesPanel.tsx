'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GitBranch, TreePine, Plus, Trash2, Eye, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/appStore'
import { getBranches, createBranch, deleteBranch, getTreeMain, chooseActiveChild } from '@/lib/api'
import { toast } from 'sonner'
import type { BranchInfo, TreeRow, Snippet } from '@/lib/types'

export function BranchesPanel() {
  const queryClient = useQueryClient()
  const { 
    currentStory, 
    branches, 
    setBranches, 
    treeRows, 
    setTreeRows, 
    chunks 
  } = useAppStore()
  
  const [newBranchName, setNewBranchName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load branches and tree data
  useEffect(() => {
    loadBranches()
    loadTreeData()
  }, [currentStory])

  const loadBranches = async () => {
    try {
      const result = await getBranches(currentStory)
      setBranches(result)
    } catch (error) {
      console.error('Failed to load branches:', error)
      toast.error('Failed to load branches')
    }
  }

  const loadTreeData = async () => {
    try {
      const result = await getTreeMain(currentStory)
      setTreeRows(result.rows || [])
    } catch (error) {
      console.error('Failed to load tree data:', error)
      toast.error('Failed to load tree data')
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast.error("Please enter a branch name")
      return
    }

    if (chunks.length === 0) {
      toast.error("No story content to create branch from")
      return
    }

    setIsLoading(true)
    try {
      // Use the last chunk as the head for now
      const headId = chunks[chunks.length - 1]?.id || 'default-head'
      await createBranch(currentStory, newBranchName.trim(), headId)
      setNewBranchName('')
      await loadBranches()
      toast.success("Branch created successfully")
    } catch (error) {
      console.error('Failed to create branch:', error)
      toast.error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"? This cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    try {
      await deleteBranch(branchName, currentStory)
      await loadBranches()
      toast.success("Branch deleted successfully")
    } catch (error) {
      console.error('Failed to delete branch:', error)
      toast.error(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChooseActiveChild = async (parentId: string, childId: string) => {
    setIsLoading(true)
    try {
      await chooseActiveChild(currentStory, parentId, childId)
      await loadTreeData()
      // Invalidate main path so editor updates to reflect the new active branch
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory] })
      toast.success("Active branch choice updated")
    } catch (error) {
      console.error('Failed to choose active child:', error)
      toast.error(`Failed to update branch choice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const formatSnippetPreview = (content: string) => {
    return content.length > 60 ? content.substring(0, 60) + '...' : content
  }

  return (
    <div className="space-y-4">
      {/* Branch Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Branches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Branch name"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
              />
              <Button
                onClick={handleCreateBranch}
                size="sm"
                disabled={isLoading || !newBranchName.trim()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Create
              </Button>
            </div>

            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {branches.length > 0 ? (
                  branches.map((branch) => (
                    <div
                      key={branch.name}
                      className="flex items-center justify-between p-2 bg-neutral-50 rounded text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{branch.name}</div>
                        <div className="text-xs text-neutral-500">
                          Head: {branch.head_id.substring(0, 8)}...
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          title="Switch to branch"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteBranch(branch.name)}
                          disabled={isLoading}
                          title="Delete branch"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 italic text-center py-2">
                    No branches created yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Tree Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            Story Tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {treeRows.length > 0 ? (
                treeRows.map((row, index) => (
                  <div key={index} className="space-y-2">
                    {/* Parent Node */}
                    <div className="font-medium text-sm text-neutral-700 uppercase tracking-wide">
                      {row.parent.kind} • {row.parent.id.substring(0, 8)}
                    </div>
                    
                    {/* Children */}
                    <div className="space-y-1 ml-4 border-l-2 border-neutral-200 pl-3">
                      {row.children.map((child) => {
                        const isActive = row.parent.child_id === child.id
                        return (
                          <div
                            key={child.id}
                            className={`flex items-start gap-2 p-2 rounded text-sm ${
                              isActive 
                                ? 'bg-blue-50 border border-blue-200' 
                                : 'bg-neutral-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${
                                  isActive ? 'text-blue-700' : 'text-neutral-600'
                                }`}>
                                  {child.kind.toUpperCase()}
                                </span>
                                {isActive && <CheckCircle className="h-3 w-3 text-blue-600" />}
                              </div>
                              <div className="text-xs text-neutral-600 mt-1">
                                {formatSnippetPreview(child.content)}
                              </div>
                            </div>
                            {!isActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={() => handleChooseActiveChild(row.parent.id, child.id)}
                                disabled={isLoading}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500 italic text-center py-4">
                  No branching structure available yet
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
