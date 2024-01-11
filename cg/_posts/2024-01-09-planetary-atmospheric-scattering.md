---
layout: post
title: Planetary Atmospheric Scattering
description: >
  Atmospheric scattering is a complex process that occurs when sunlight interacts with particles in a planetary atmosphere, resulting in visually striking phenomena such as the blue sky and colorful sunsets.
image: /assets/img/blog/space.png
sitemap: false
accent_image: /assets/img/blog/space.png
---

**Atmospheric scattering is complicated.** It involves intricate light interactions with various particles and gases within a planet's atmosphere, and the light transport equation in a participating medium applied to the atmosphere is very difficult to solve. Therefore, many promises have been made in earlier works to render atmospheric phenomena such as sunsets, sky colors, and aerial perspectives in real-time. [Eric Bruneton and Fabrice Neyret's approach](https://github.com/ebruneton/precomputed_atmospheric_scattering?tab=readme-ov-file) aims to overcome these challenges by employing precomputed atmospheric scattering techniques. The method significantly reduces the computational demands commonly associated with atmospheric rendering using precomputed look-up tables for key components like transmittance, single scattering, multiple scattering, and ground irradiance.

In this post, we discuss a project Jerry Lu and I completed for the Advanced Computer Graphics Course at Rensselaer Polytechnic Institute, building upon Bruneton and Neyret's work. Our project involved experimenting with and implementing this method, which precomputes the light transport equation to simulate light scattering processes in real-time. This is done considering various viewpoints, view directions, and sun directions. We employed precomputed look-up tables (LUTs) for essential elements like transmittance, single and multiple scattering, and ground irradiance. This approach enabled our implementation to be highly efficient, maintaining impressive performance levels and delivering visually striking results.

_Due to time constraints, our implementation does not include the complete methodology described in the original paper; specifically, we omitted the illuminance as well as the shadows and light shafts component. Despite these modifications, our implementation still captures the essence of the original work and produces accurate and lovely renderings of the planetary atmosphere without compromising the overall results._


## Atmospheric models

Atmospheric scattering primarily consists of two physical phenomena: Rayleigh and Mie scattering, which are the main contributors to the colors of our sky. Rayleigh scattering is an optical phenomenon predominantly responsible for clear blue skies and vibrant orange-red sunsets. As light passes through the air, it interacts with small molecules whose wavelengths are much shorter, resulting in wavelength-sensitive scattering. In contrast, Mie scattering takes place during overcast weather and creates the distinctive Tyndall effect. It occurs when the size of airborne particles, such as those found in fog, smoke, and dust, is approximately equal to or greater than the wavelength of light. Unlike Rayleigh scattering, Mie scattering does not exhibit wavelength sensitivity and has a limited capacity to alter the color of incoming light. A more detailed overview of atmospheric scattering is shown in Figure 1.

![](/assets/img/blog/as-overview.png){:.lead width="1600" height="1200" loading="lazy"}

Figure 1: An overview of atmospheric scattering. A: zero scattering. B: single scattering. C: multiple scattering. Solving for a physically accurate radiance of light $$L$$ reaching $$\mathbf{x}$$ from direction $$\mathbf{v}$$ when the sun is in direction $$\mathbf{s}$$ requires: D: light reflected at $$\mathbf{x}_0$$. E: transmittance $$T$$ results from absorption and out-scattered light. F: is the light scattered in direction $$-\mathbf{v}$$. G: light scattered towards $$\mathbf{x}$$ between $$\mathbf{x}_0$$ and $$\mathbf{x}$$, from any direction. Note that occlusion, like the mountain in the figure, can significantly affect the final calculated $$L$$. As a result, we account for occlusion in zero scattering but disregard it in other cases to minimize performance overhead.
{:.figcaption}

#### Physical model

Incorporating the aforementioned scatterings, we can develop a physical model consists of air molecules and aerosol particles, in a thin spherical layer of decreasing density between $$R_g = 6360 \ km$$ and $$R_t = 6420 \ km$$. At any given point, the proportion of light scattered $$\theta$$ degrees from its incident direction is determined by the product of a scattering coefficient $$\beta_s$$ and a phase function $$P$$. The particle density influences $$\beta_s$$, while $$P$$ delineates the angular dependency. For smaller air molecules, both $$\beta_s$$ and $$P$$ are defined by Rayleigh theory:

$$
  \begin{aligned}
    \beta_R^s(h,\lambda)&=\frac{8\pi^3\left(n^2-1\right)^2}{3N\lambda^4}e^{-\frac{h}{H_R}} \\[1em]
    P_R(\mu)&=\frac{3}{16\pi}\left(1+\mu^2\right)
  \end{aligned}
$$

where $$\mu = \cos \theta$$, $$h = r - R_g$$ is the altitude, $$\lambda$$ is the wavelength, $$n$$ is the index of refraction of air, $$N$$ is the molecular density at sea level $$R_g$$, and $$H_R = 8 \ km$$ is the thickness of the atmosphere if its density were uniform. Similarly, the Mie theory defines the scattering coefficient $$\beta_s$$ and a phase function $$P$$ for larger aerosols for a smaller height scale $$H_M \approx 1.2 \ km$$ with an exponentially decreasing density:

$$
  \begin{aligned}
    \beta_M^s(h,\lambda)&=\beta_M^s\left(0,\lambda\right)e^{-\frac{h}{H_R}} \\[1em]
    P_M(\mu)&=\frac{3}{8\pi}\frac{\left(1-g^2\right)\left(1+\mu^2\right)}{\left(2+g^2\right)\left(1+g^2-2g\mu\right)^\frac{3}{2}}
  \end{aligned}
$$

Aerosols also absorb a fraction of the incident light, which is measured with an absorption coefficient $$\beta_M^a$$. Combining the absorption and scattering coefficient gives us the extinct coefficient $$\beta_M^e = \beta_M^a + \beta_M^s$$ ($$\beta_R^e = \beta_R^s$$ for air molecules). The ozone layer also has a large impact on the appearance of the Earth's atmosphere, and the absorption of ozone contributes to the sky's blue hue when the sun is near the horizon. We approximate the absorption rate by the following equation:

$$
\beta_O^a(h,\lambda)=\beta_O^0(\lambda)\max\left\{0,1-\frac{\|h-25km\|}{15km}\right\}
$$

In real-time rendering, we can not afford to compute light scattering for each individual wavelength. Instead, we approximate the energy distribution across the spectrum using the three RGB components, so the $$\lambda$$ term is assigned to a certain value, referred to as $$\lambda_0$$. Therefore, we have the following functions for scattering coefficient $$\beta_s$$, extinction coefficient $$\beta_t$$ and phase function $$P$$:

$$    
  \begin{aligned}
      \beta_s(h,\lambda)&=\beta_R^s(h)+\beta_M^s(h) \\[1em]
      \beta_e(h,\lambda)&=\beta_R^s(h)+\beta_M^e(h)+\beta_O^a(h) \\[1em]
      P(\mu)&=\frac{\beta_R^s(h)}{\beta_s(h)}P_R(\mu)+\frac{\beta_M^s(h)}{\beta_s(h)}P_M(\mu)
  \end{aligned}
$$

which we will use for calculating atmospheric scattering and discuss later.

#### Rendering equation

In the work by Eric Bruneton and Fabrice Neyret, the rendering equation is presented as follows:

$$
L(\mathbf{x},\mathbf{v},\mathbf{s})=(L_0+\mathcal{R}[L]+\mathcal{S}[L])(\mathbf{x},\mathbf{v},\mathbf{s})
$$

where $$L(\mathbf{x},\mathbf{v},\mathbf{s})$$ represent the radiance of sunlight in direction $$\mathbf{s}$$, reaching point $$\mathbf{x}_0$$ from the viewing direction $$\mathbf{v}$$ (see Figure 1). In order to better understand the rendering equation, we need to specify a few additional terms:

$$
  \begin{aligned}
    T(\mathbf{x},\mathbf{x}_0)&=\exp\left(-\int_{\mathbf{x}}^{\mathbf{x}_0}\sum_{i\in\{R,M\}}^{}\beta_i^e(\mathbf{y})\,\mathrm dy\right) \\[1em]
    \mathcal{I}[L](\mathbf{x}_0,\mathbf{s})&=\frac{\alpha(\mathbf{x}_0)}{\pi}\int_{2\pi}^{}L(\mathbf{x_0},\boldsymbol{\omega},\mathbf{s})\boldsymbol{\omega}.\mathbf{n}(\mathbf{x}_0)\,\mathrm d\omega\text{ or }0 \\[1em]
    \mathcal{J}[L](\mathbf{y},\mathbf{v},\mathbf{s})&=\int_{4\pi}^{}\sum_{i\in\{R,M\}}^{}\beta_i^s(\mathbf{y})P_i(\mathbf{v},\mathbf{w})L(\mathbf{y},\boldsymbol{\omega},\mathbf{s})\,\mathrm d\omega
  \end{aligned}
$$

$$\mathcal{I}$$ is null on the top atmosphere boundary.
{:.figcaption}

Assume the ray $$\mathbf{x}+t\mathbf{v}$$ extends to the atmosphere's boundary, where $$\mathbf{x}_0$$ is either at the ground or the atmospheric boundary where $$r=R_t$$, then $$T$$ represents the transmittance between $$\mathbf{x}_o$$ and $$\mathbf{x}$$, $$\mathcal{I}$$ represents the radiance of light reflected at $$\mathbf{x}_0$$, and the radiance $$\mathcal{J}$$ of light scattered at $$\mathbf{y}$$ in direction $$-\mathbf{v}$$. With these notions, the terms in the rendering equation can be expanded as follows:

$$
  \begin{aligned}
    L_0(\mathbf{x},\mathbf{v},\mathbf{s})&=T(\mathbf{x},\mathbf{x}_0)L_{sun}\text{ or }0 \\[1em]
    \mathcal{R}[L](\mathbf{x},\mathbf{v},\mathbf{s})&=T(\mathbf{x},\mathbf{x}_0)\mathcal{I}[L](\mathbf{x}_0,\mathbf{s}) \\[1em]
    \mathcal{S}[L](\mathbf{x},\mathbf{v},\mathbf{s})&=\int_{\mathbf{x}}^{\mathbf{x}_0}T(\mathbf{x},\mathbf{y})\mathcal{J}[L](\mathbf{y},\mathbf{v},\mathbf{s})\,\mathrm dy
  \end{aligned}
$$

If $$\mathbf{v} \neq \mathbf{s}$$ or the sun is occluded by terrain, $$L_0$$ becomes null.
{:.figcaption}

where $$L_0$$ represents the attenuation value of direct sunlight $$L_{sun}$$ as it reaches $$\mathbf{x}$$ via $$T(\mathbf{x}, \mathbf{x}_0)$$. $$\mathcal{R}[L]$$ denotes the light reflection at $$\mathbf{x}_0$$ and the attenuation value of the light before it reaches $$\mathbf{x}$$. Meanwhile, $$\mathcal{S}[L]$$ is the internal scattering towards $$\mathbf{x}$$ between $$\mathbf{x}$$ to $$\mathbf{x}_0$$. 

## Transmittance

The transmittance $$T$$ represents the proportion that remains unabsorbed or unattenuated after a beam of light travels from one point to another. By definition, $$T$$ depends only on the positions of the two points and is independent of terrain. Therefore, we can examine it under the assumption of a smooth planetary surface (i.e., all distances from the surface to the sphere's center are equal to $$R$$) when solving for $$T$$. Upon determining $$T$$, we store it in a precomputed texture that will be accessed during the rendering process.

![](/assets/img/blog/as-detail.png){:.lead width="1900" height="520" loading="lazy"}

Figure 2: Details about transmittance, texture mapping, and single scattering. (a): the transmittance between $$p$$ and $$q$$. (b): mapping between $$(r,\mu)$$ and the texture coordinates $$(u,v)$$. (c): the single scattered radiance at $$p$$ after the scattering event at $$q$$.
{:.figcaption}

#### Transmittance model

In terms of computation, the transmittance between two points $$p$$ and $$q$$ is the transmittance between $$p$$ and the nearest intersection $$i$$ of the half-line $$[p,q)$$ with either the top or bottom atmospheric boundary (See Figure 2). We then divide this value by the transmittance between $$q$$ and $$i$$ (or use 0 if the segment $$[p,q]$$ intersects the ground). Because the transmittance values between $$p$$ and $$q$$ and between $$q$$ and $$p$$ are the same, it is sufficient to know the transmittance between a point $$p$$ in the atmosphere and points $$i$$ on the top atmosphere boundary to compute the transmittance between arbitrary points. The transmittance then depends on only two parameters, which can be taken as the radius $$r=\| op \|$$ and the cosine of the "view zenith angle", $$\mu = op (\cdot pi / \| op \| \| pi \|)$$. Based on the definition and the Beer-Lambert law, solving for transmittance involves integrating the density of air molecules, aerosols, and air molecules that absorb light (e.g., ozone) along the same segment $$[p, i]$$. 

#### Transmittance precomputation

To store the calculated transmittance, we need to map the two parameters $$(r, \mu)$$ to the texture coordinates $$(u, v)$$, and perform the inverse mapping when retrieving the solution during the rendering process. The original paper provided a generic mapping technique that works for any atmosphere and provides an increased sampling rate near the horizon: $$r = \|x\|$$, and $$\mu$$ equals a value $$x_{\mu}$$ between 0 and 1 by considering the distance $$d$$ to the top atmosphere boundary, where $$d_{\text{min}} = r_{\text{top}} - r$$ and $$d_{\text{max}} = \rho + H$$ (See Figure 2).

#### Transmittance look-up

While rendering, we can get the transmittance between two arbitrary points $$p$$ and $$q$$ inside the atmosphere using just two texture look-ups. This is because the transmittance between $$p$$ and $$q$$ equals the transmittance between $$p$$ and the top atmospheric boundary divided by the transmittance between $$q$$ and the top atmospheric boundary, and vice versa. It is worth to mention that we also need the atmospheric transmittance to the Sun when calculating single scattering and sky irradiance.  During which step, we approximate by integrating over its disc, assuming constant transmittance except below the horizon. We calculate it using top atmosphere boundary transmittance multiplied by the visible Sun disc fraction. It is important to note that we do not perform the ray-ground intersection testing step here. Instead, we implement the function and use it on the caller side. This is because results could be inaccurate for rays close to the horizon, as finite precision and rounding errors in floating-point operations can cause discrepancies.

## Single scattering

By single scattering, we mean that there has only been one scattering event since the light left the light source before it reached the observer's eye. The single scattered radiance is responsible for the majority of the color we see because the atmosphere scatters light at a relatively low rate.

#### Single scattering model

Consider the Sun light scattered at a point $$q$$ by air molecules or aerosols particles before arriving at another point $$p$$, the radiance arriving at $$p$$ is the product of:


* the solar irradiance at the top of the atmosphere.
* the fraction of the Sun light at the top of the atmosphere that reaches $$q$$, $$T(\text{Sun},q)$$.
* the Rayleigh or Mie scattering coefficient at $$q$$. 
* the Rayleigh or Mie phase function.
* the fraction of the light scattered at $$q$$ towards $$p$$ that reaches $$p$$, $$T(q,p)$$.

where a total of 4 parameters needed (See Figure 3):

* $$r$$ is the distance from $$p$$ to the center of the sphere.
* $$\mu$$ is the angle formed by extending the radius from point $$p$$ to atmosphere boundary and the line segment connecting points $$p$$ and $$q$$.
* $$\mu_s$$ is the angle formed by extending the radius from point $$p$$ to atmosphere boundary and the unit direction vector towards the Sun $$\omega_s$$.
* $$\nu$$ is the angle formed by the same unit direction vector for $$\mu_s$$ and line segment connecting points $$p$$ and $$q$$.

#### Single scattering precomputation

Single scattering is quite expensive, and many evaluations are needed to compute multiple scattering due to the recursive nature of the rendering equation. We, therefore, want to precompute the solution and save the results to texture, which requires a mapping from the 4 function parameters to texture coordinates. This requires a 4D texture, and a function that maps $$(r,\mu,\mu_s, \nu)$$ to texture coordinates $$(u,v,w,z)$$. 
    
The mapping between $$r,\nu$$ and $$u,z$$ roughly follows the same procedure we mentioned in the previous section. However, the mapping between $$\mu,\mu_s$$ and $$v,w$$ is more complex. The mapping for $$\mu$$ takes the minimal distance to the nearest atmosphere boundary into account to map it to $$[0,1]$$ interval. On the other hand, the mapping for $$\mu_s$$ relies on the distance to the top atmosphere boundary and uses a configurable parameter, but still maintains a higher sampling rate near the horizon.

#### Single scattering look-up

With the help from precomputed texture generated using the method discussed previously, we can now get the scattering between a point and the nearest atmosphere boundary with two texture look-ups in real-time, which guarantees efficient multiple scattering calculations described in the next section. In particular, we employ two 3D texture look-ups to simulate a single 4D texture lookup using quadrilinear interpolation.


## Multiple scattering

By multiple scattering, we mean that the light from the Sun reaches the observer's eye after undergoing two or more bounces within the atmosphere. These bounces consist of scattering events, where light interacts with atmospheric particles, or reflections off the ground.

#### Multiple scattering model

Multiple scattering can be broken down into the sum of double scattering, triple scattering, and so on, with each term representing light reaching a point in the atmosphere after exactly two, three, etc., bounces. In addition, each term can be calculated based on the previous one; that is, the light arriving at some point $$p$$ from direction $$\omega$$ after $$n$$ bounces is an integral over all the possible points $$q$$ for the last bounce, which involves the light arriving at $$q$$ from any direction, after $$n-1$$ bounces.

Unfortunately, the calculation at each scattering order requires a triple integral based on the previous scattering order: one integral over all the points $q$on the line segment from $$p$$ to the nearest atmosphere boundary in direction $$\omega$$, as well as a nested double integral over all directions at each point $$q$$. It will be extremely inefficient if we perform the calculation naively. As suggested by Eric Bruneton and Fabrice Neyret in their work, we use the following algorithm when dealing with multiple scattering:

~~~python
    # Precompute single scattering in a texture.
    if scattering_order >= 2:
      for q in points:
        for omega in directions:
          # Look up (n-1)-th scattering texture
          # Compute the scattered light at q towards omega
      for p in points:
        for omega in directions:
          # Look up the texture computed on line 6
          # Compute the scattered light at p towards omega
~~~

Multiple scattering computation
{:.figcaption}

where the calculations for $$p$$ involve only a double integral, and the calculations for $$q$$ involve only a single integral, since it is based on the precomputed texture in the previous step.

#### Multiple scattering precomputation
To save computation time when calculating the next order, we must precompute each scattering order in a texture, which requires a mapping from function parameters to texture coordinates. Fortunately, all scattering orders rely on the same $$(r,\mu,\mu_s,\nu)$$ parameters as the single scattering described in Section 4. Therefore, we can conveniently reuse the mappings defined for single scattering.

#### Multiple scattering look-up
Likewise, we can simply reuse the same look-up procedure for single scattering to read a value from the precomputed textures for multiple scattering.

## Ground irradiance

Ground irradiance, which is the sunlight received at the planet's surface after $$n \geq 0$$ bounces, plays an important role in precomputing the $$n$$-th order of scattering, where $$n \geq 2$$, in determining the light path contributions with their $$(n-1)$$-th bounce on the ground. In this case, we require ground irradiance only for horizontal surfaces situated at the bottom of the atmosphere for a uniform albedo spherical planet. Furthermore, during the rendering process, we need to compute the contribution of light paths with their final bounce on the ground to achieve an accurate result. Different from the previous case, we need ground irradiance for varying altitudes and surface normals, and precomputation is desired for efficiency. In line with the original work, we precompute irradiance only for horizontal surfaces at any altitude, using 2D textures as a substitute for the more complex 4D textures required in the general case.

#### Ground irradiance model

Irradiance is calculated as the integral over a hemisphere of the incident radiance, multiplied by a cosine factor. For ground irradiance computation, we divide it into direct and indirect components. The direct ground irradiance is determined by the Sun's incident radiance at the top of the atmosphere, multiplied by the transmittance through the atmosphere. Given the small solid angle of the Sun, we can approximate transmittance as a constant and move it outside the irradiance integral, which should be performed over the visible fraction of the Sun's disc rather than the entire hemisphere. For indirect ground irradiance, the integral over the hemisphere must be calculated numerically. Specifically, we need to compute the integral over all directions $$\omega$$ of the hemisphere, considering the product of the radiance arriving from direction $$\omega$$ after $$n$$ bounces and the cosine factor $$\omega_z$$.

#### Ground irradiance precomputation

As mentioned in the previous section, the irradiance depends only on $$r$$ and $$\mu_s$$ because we precompute the ground irradiance only for horizontal surfaces. Therefore, we only need a mapping from ground irradiance parameters $$(r,\mu_s)$$ to texture coordinates $$(u,v)$$, and a simple affine mapping is sufficient because of the smooth ground irradiance function.

#### Ground irradiance look-up

The ground irradiance look-up is relatively straightforward, as it can be accomplished with just a single texture look-up similar to what we did for transmittance textures.

![](/assets/img/blog/as-luts.png){:.lead width="1500" height="400" loading="lazy"}

Figure 3: Look-up tables/textures. (a): The 2D transmittance texture. (b): The 4D single scattering texture. (c): The 4D scattering texture that combines all scattering orders (4 scattering orders in this case). (d) The 2D ground irradiance texture.
{:.figcaption}

## Results and discussion

All rendering of this paper is provided by the CPU renderer, which samples the entire spectrum to give a radiance spectrum of pixels. Based on this radiance spectrum, we can calculate the color of the pixels in different ways. If not explicitly stated, the result is to first integrate the radiance spectrum with the CIE XYZ basis, converting it to CIE XYZ luminance and then to linear sRGB luminance.  The output images are saved as PNG at 8-bit for each channel, after the luminance is gamma corrected ($$\gamma = 2.2$$) and tone mapped.  Figure 4 (a) shows a less-accurate result with only 3 radiance samples without converting to sRGB.  The GPU renderer aims to be real-time by sacrificing the color accuracy, which only samples at RGB wavelengths for radiance.

Precomputation takes about 200 seconds to generate all the LUTs in 20 threads with fourth order multiple scattering.  Once generated, the LUTs are simply copied to memory and rendered immediately.  The GPU renderer can read half precision LUTs and render the atmosphere at more than 144 frames per second, and can adjust the camera and the position of the sun in real time.

With the limited time, we could only work on implementing Eric Bruneton and Fabrice Neyret's work. There is an efficient model further speed up the computation. Another future work that could fully exploit the ability of rendering full radiance spectrum is to enable the engine to write RGBE files, which could preserve all the radiance data for high dynamic range displays.  Although we also mentioned cloud rendering in the proposal as a side quest, this could also be a future work that could render the interactions between the atmosphere and realistic clouds.

![](/assets/img/blog/as-results.png){:.lead width="1900" height="350" loading="lazy"}

Figure 4: Planetary atmospheric scattering results from different camera angles and positions. (a): A dawn scene from the planetary surface radiance. (b) A sunrise scene from the planetary surface. (c) An outer space scene that showcases planetary atmospheric scattering on a larger scale.
{:.figcaption}
