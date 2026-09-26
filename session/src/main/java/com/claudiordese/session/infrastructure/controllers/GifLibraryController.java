package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.GifLibraryService;
import com.claudiordese.session.infrastructure.controllers.request.gif.FolderRequest;
import com.claudiordese.session.infrastructure.controllers.request.gif.SaveGifRequest;
import com.claudiordese.session.infrastructure.controllers.response.gif.FolderResponse;
import com.claudiordese.session.infrastructure.controllers.response.gif.GifResponse;
import com.claudiordese.session.infrastructure.controllers.response.gif.LibraryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

import static com.claudiordese.session.util.AuthenticationUtils.currentRoles;
import static com.claudiordese.session.util.AuthenticationUtils.currentUserId;

@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/gif-library")
@Tag(name = "GIF library", description = "The signed-in user's saved GIFs and folders.")
@SecurityRequirement(name = "bearerAuth")
public class GifLibraryController {

    private final GifLibraryService library;

    @GetMapping
    @Operation(summary = "Folders, which folders hold each saved GIF, and this user's limits")
    public LibraryResponse get(Authentication authentication) {
        return LibraryResponse.from(library.library(currentUserId(authentication), currentRoles(authentication)));
    }

    @PostMapping("/folders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a folder (Premium roles only; limits by role)")
    public FolderResponse createFolder(Authentication authentication, @Valid @RequestBody FolderRequest request) {
        return FolderResponse.from(
                library.createFolder(currentUserId(authentication), currentRoles(authentication), request.name()));
    }

    @PutMapping("/folders/{folderId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Rename a folder (not Favorites)")
    public void renameFolder(Authentication authentication, @PathVariable UUID folderId, @Valid @RequestBody FolderRequest request) {
        library.renameFolder(currentUserId(authentication), folderId, request.name());
    }

    @DeleteMapping("/folders/{folderId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a folder and the GIFs in it (not Favorites)")
    public void deleteFolder(Authentication authentication, @PathVariable UUID folderId) {
        library.deleteFolder(currentUserId(authentication), folderId);
    }

    @GetMapping("/folders/{folderId}/gifs")
    @Operation(summary = "GIFs in a folder, newest first; q filters by title")
    public List<GifResponse> gifs(
            Authentication authentication,
            @PathVariable UUID folderId,
            @RequestParam(name = "q", required = false) String query) {
        return library.gifs(currentUserId(authentication), folderId, query).stream().map(GifResponse::from).toList();
    }

    @PutMapping("/folders/{folderId}/gifs/{gifId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Save a GIF into a folder (idempotent)")
    public void addGif(
            Authentication authentication,
            @PathVariable UUID folderId,
            @PathVariable String gifId,
            @Valid @RequestBody SaveGifRequest request) {
        library.addGif(currentUserId(authentication), currentRoles(authentication), folderId, gifId,
                request.title(), request.previewUrl(), request.url());
    }

    @DeleteMapping("/folders/{folderId}/gifs/{gifId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a GIF from a folder")
    public void removeGif(Authentication authentication, @PathVariable UUID folderId, @PathVariable String gifId) {
        library.removeGif(currentUserId(authentication), folderId, gifId);
    }
}
