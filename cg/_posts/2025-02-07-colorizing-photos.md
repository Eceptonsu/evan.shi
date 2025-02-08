---
layout: post  
title: Reconstructing Century-Old Color Photos  
description: >  
  Sergei Mikhailovich Prokudin-Gorskii pioneered early color photography by capturing three-filtered monochrome images on glass plates. Modern image processing techniques can automatically restore these historical images with minimal artifacts.  
image: /assets/img/blog/pg-photo/cover.jpg  
sitemap: false  
accent_image: /assets/img/blog/pg-photo/cover.jpg  
accent_color: '#441208'  
theme_color: '#441208'
---

**[Sergei Mikhailovich Prokudin-Gorskii](https://en.wikipedia.org/wiki/Sergey_Prokudin-Gorsky)** (1863–1944) was a pioneering Russian photographer who foresaw the future of color photography. His method involved capturing three separate monochrome images using red, green, and blue filters on a single glass plate. When properly aligned and combined, these monochrome layers would produce a full-color image—an extraordinary feat at a time when color printing was challenging.

His groundbreaking work gained recognition, particularly for the **only** color portrait of [Leo Tolstoy](https://en.wikipedia.org/wiki/Leo_Tolstoy). The Russian Tsar granted him funding and permission to travel across the empire, documenting its people, landscapes, and architecture in color. These historical glass plate negatives were later acquired by the **Library of Congress** in 1948 and are now digitized and publicly available [online](https://www.loc.gov/pictures/search/?q=Prokudin+negative&sp=2&st=grid).

## Overview of the Project

This project was part of the **Advanced Topics in Computer Graphics (Spring 2025)** course at Yale University. The goal was to take the digitized Prokudin-Gorskii glass plate images and reconstruct high-quality color photographs with minimal visual artifacts. The process involved:

1. Extracting the individual blue, green, and red channels from each glass plate scan.
2. Aligning these channels precisely to form a coherent color image.
3. Refining the alignment using advanced transformations like scaling and rotation.
4. Post-processing the images to enhance contrast, remove borders, and correct color balance.

## Extracting and Preparing Channels  

Each scanned `.tif` file typically contains the three filtered images stacked vertically. The initial step in the code (not shown here) splits the image into separate blue, green, and red channels. Before alignment, each channel may be normalized into a floating-point representation to facilitate subsequent image operations.  


## Single-Scale Alignment (Exhaustive Search)

At first, a straightforward approach was used: treat the alignment problem as finding the best translation of one channel relative to another. For a small search range, the code tests every possible (dx, dy) offset and calculates a similarity score. Two main metrics guide this alignment:

- Sum of Squared Differences (SSD)

$$
  \begin{aligned}
    \mathrm{SSD}(I_1, I_2) = \sum_{x,y} \bigl(I_1(x,y) - I_2(x,y)\bigr)^2
  \end{aligned}
$$

Measures the pixel-wise squared difference between two images. The lower the SSD score, the better the alignment.  

- Normalized Cross-Correlation (NCC)

$$
  \begin{aligned}
    \mathrm{NCC}(I_1, I_2) = \frac{\sum_{x,y}\left[\left(I_1(x,y)-\bar{I_1}\right)\left(I_2(x,y)-\bar{I_2}\right)\right]}
            {\sqrt{\sum_{x,y}\left(I_1(x,y)-\bar{I_1}\right)^2}\,
             \sqrt{\sum_{x,y}\left(I_2(x,y)-\bar{I_2}\right)^2}}
  \end{aligned}
$$

Measures the correlation between two images after normalizing for brightness variations. The higher the NCC score, the better the alignment.

In practice, single-scale alignment can work well for smaller images or when the three channels are already fairly close. However, as `.tif` files grow large, an exhaustive search that checks each offset becomes computationally expensive.

#### Pseudocode for Single-Scale Alignment
```
For each possible shift (dx, dy) in the range [-shift_range, +shift_range]:
    1. Crop the image slightly to ignore noisy edges.
    2. Apply the shift (dx, dy) to the target channel.
    3. Compute the similarity score using SSD or NCC.
    4. Keep track of the shift with the best score.

Return the best (dx, dy) shift.
```
This approach is effective for small images but becomes computationally expensive for large `.tif` files due to the large number of pixel comparisons.

### Multi-Scale Alignment (Image Pyramid)  

To address the computational bottleneck for large images, a **multi-scale (pyramidal) alignment** scheme was introduced. The idea is to downsample the images to a smaller size, find an approximate alignment at this coarser scale, and then use the result as a starting point for a finer resolution. This recursive process continues until the full-resolution alignment is obtained. By narrowing down the search space at progressively higher resolutions, the code avoids an enormous brute-force search at the largest scale.  

Multi-scale alignment involves:  
- Reducing the image dimensions by half (or another factor) to form a pyramid.  
- Running single-scale alignment at the smallest layer for a coarse alignment.  
- Upsampling the shift parameters back to the next layer and refining locally.  
- Iterating until the full-resolution image is aligned accurately.

#### Pseudocode for Multi-Scale Alignment
```
If image is small enough:
    Perform single-scale alignment and return shift.

Else:
    1. Downsample the image by 2x.
    2. Recursively align the downsampled image.
    3. Multiply the resulting shift by 2.
    4. Perform a local refinement search around the upsampled shift.
    
Return the refined shift.
```

This hierarchical approach significantly reduces computation time while maintaining high accuracy.

<div class="gallery" style="--columns: 3;">
  <a href="/assets/img/blog/pg-photo/multi_aligned_1.jpg" data-lightbox="pg-set-1" data-title="Multi-aligned Example Image 1">
    <img src="/assets/img/blog/pg-photo/multi_aligned_1.jpg" alt="Multi-aligned Example Image 1">
  </a>
  <a href="/assets/img/blog/pg-photo/multi_aligned_2.jpg" data-lightbox="pg-set-1" data-title="Multi-aligned Example Image 2">
    <img src="/assets/img/blog/pg-photo/multi_aligned_2.jpg" alt="Multi-aligned Example Image 2">
  </a>
  <a href="/assets/img/blog/pg-photo/multi_aligned_3.jpg" data-lightbox="pg-set-1" data-title="Multi-aligned Example Image 3">
    <img src="/assets/img/blog/pg-photo/multi_aligned_3.jpg" alt="Multi-aligned Example Image 3">
  </a>
</div>

Figure 1-3: Examples of images aligned using multi-scale alignment. Click on an image to view it in full resolution.
{:.figcaption}

## Extending Alignment with Scale and Rotation  

Some of Prokudin-Gorskii’s plates exhibit slight scale variations or rotational offsets due to scanning inconsistencies or historical distortions. A purely translational model fails in those cases, so an **affine transformation** that accommodates scale changes and rotation is beneficial.  

An extended version of the alignment algorithm systematically explores small variations in scale and angle in addition to (dx, dy) shifts. For each possible set of parameters, the code applies an affine transform (provided by libraries such as `scikit-image`) to warp the channel and then measures alignment quality with a chosen metric (SSD or NCC). This approach is more computationally demanding, so the code can use parallelization tools (e.g., `joblib`) to distribute computations across multiple CPU cores.  

## Post-Processing Enhancements  

Once the channels are correctly aligned, the combined color images still require some polish:

- Auto-Cropping Borders: The glass plate scans often have large empty or noisy borders. A method based on detecting uniform regions automatically locates the largest connected area of “valid” pixels and discards the rest.  
- Auto-Contrast Adjustment: Each color channel can be rescaled to use the full [0, 1] intensity range, improving overall contrast.  
- Gray World White Balance: Under a “gray world” assumption, the average color in a scene should be neutral gray. Any deviation in the mean RGB values is corrected, yielding a more natural color balance.

These steps can dramatically improve the final appearance, removing distracting borders, increasing clarity, and making colors appear more consistent across the dataset. Below are refined images for the same set of plates shown earlier.

<div class="gallery" style="--columns: 3;">
  <a href="/assets/img/blog/pg-photo/refined_1.jpg" data-lightbox="pg-set-2" data-title="Refined Example Image 1">
    <img src="/assets/img/blog/pg-photo/refined_1.jpg" alt="Refined Example Image 1">
  </a>
  <a href="/assets/img/blog/pg-photo/refined_2.jpg" data-lightbox="pg-set-2" data-title="Refined Example Image 2">
    <img src="/assets/img/blog/pg-photo/refined_2.jpg" alt="Refined Example Image 2">
  </a>
  <a href="/assets/img/blog/pg-photo/refined_3.jpg" data-lightbox="pg-set-2" data-title="Refined Example Image 3">
    <img src="/assets/img/blog/pg-photo/refined_3.jpg" alt="Refined Example Image 3">
  </a>
</div>

Figure 4-6: Final images after post-processing. Click on an image to view it in full resolution.
{:.figcaption}

## Challenges & Observations  

Throughout the project, several challenges emerged. One notable difficulty was handling images with repetitive patterns, which often misled the alignment algorithm into a **local minimum**, resulting in misaligned images, as seen in the example below. This issue arose because certain textures created multiple visually similar alignment points, causing the algorithm to settle on an incorrect shift. Another major challenge was the **computational cost** of searching over scale and rotation parameters. To mitigate this, we employed multi-scale alignment, parallelization, and efficient filtering techniques, significantly reducing the computational burden of exhaustive pixel-by-pixel comparisons. Additionally, raw-pixel matching sometimes struggled in areas with **high brightness fluctuations** or **fading emulsion** on the glass plates. Switching to feature-based matching—such as edge detection—improved robustness, as edges are less sensitive to global intensity variations.  

![](/assets/img/blog/pg-photo/misaligned.jpg){:.lead width="3800" height="3241" loading="lazy"}  
Figure 7: Example of misalignment caused by local minima.  
{:.figcaption}

## Conclusion  

This project demonstrates how classical algorithms can be combined with modern computational tools to restore historical color photographs automatically. By taking three monochrome scans from Prokudin-Gorskii’s glass plates, applying multi-scale alignment with optional affine transformations, and then refining the result with feature-based matching and post-processing, it becomes possible to create vivid color images that reveal the extraordinary detail captured over a century ago.

These techniques carry broader value beyond historical archives. Multi-scale alignment, affine transformations, and feature extraction are cornerstones of **computer vision** and **computational photography**, underscoring how these fields unite academic insights with the preservation and celebration of cultural heritage.